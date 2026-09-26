import { queueInvoiceEmail } from "../lib/businessMail";
import type { FastifyInstance } from "fastify";
import { prisma } from "@stackfox/prisma";
import { requireAuth } from "../plugins/auth";
import { applyTierMultiplier, computeEstimateRange } from "../lib/estimate";
import {
  createRazorpayOrder,
  verifyRazorpaySignature,
  fetchCapturedPayment,
  assertPaymentInitiationEnabled,
} from "../lib/payments";
import { getContractTypes, getMilestoneTemplates, isAdminRole } from "@stackfox/core";
import { emitEvent } from "../lib/events";
import { toJson } from "../lib/json";
import { LIST_CAP, pageParams, paginated } from "../lib/http";
import { ensurePersonalOrg } from "../lib/scope";
import * as ids from "../lib/id";
import { resolveGstType, splitGst } from "../lib/gst";
import { log } from "../lib/logger";
import { parseBody } from "../lib/validate";
import { randomUUID } from "node:crypto";
import {
  type Db,
  recordInvoicePaymentRows,
  enqueuePaymentSideEffects,
} from "../lib/billing";
import { catalogPrice } from "../lib/pricing";
import { quotePaymentTerms } from "../lib/quotePayment";
import {
  QuoteFromCartSchema,
  QuotePaySchema,
  QuoteVerifyPaymentSchema,
  UpdateQuoteSchema,
  UpdateQuoteStatusSchema,
} from "./quoteSchemas";

interface QuoteItem {
  name: string;
  price: number;
  quantity: number;
  itemId?: string;
  itemType?: string;
}

function serializeQuote(q: any) {
  return { ...q, _id: q.id, moneyUnit: "PAISE" };
}

/**
 * Provisions an engagement from a paid quote.
 *
 * Two defects fixed here.
 *
 * GST: this hardcoded `gstType: "IGST"`, while the checkout path resolves it
 * from the client's GSTIN via resolveGstType(). A client in StackFox's own
 * State billed through this path therefore received an inter-State invoice on
 * an intra-State supply — the tax total is the same, but the CGST/SGST split
 * and the GSTR-1 section are wrong. Two provisioning paths that disagree about
 * tax is exactly the drift that duplicated code produces.
 *
 * Atomicity: it was a dozen independent writes, so a failure partway left an
 * ACTIVE engagement with no contracts and no invoice against a quote the
 * client had already paid.
 *
 * The checkout path (routes/checkout.ts) still has its own provisioning shell
 * because it works from an Estimate canvas rather than cart items and also
 * creates an Order. Merging the two shells is a larger refactor; what mattered
 * was that they stop disagreeing about policy, which they now cannot — tier
 * milestones, contract sets and GST all come from one place.
 */
async function provisionQuote(quote: any, userId: string, tx: Db, orgId: string) {
  const items = ((quote.items as any[]) || []).filter((i) => i?.itemId);
  const tier = quote.tier || "GROWTH";
  const engId = ids.engagementId();

  // Resolve the tax treatment from the billing org, exactly as checkout does.
  const billTo = await tx.org.findUnique({ where: { id: orgId } });
  const gstType = resolveGstType(billTo);
  const { cgst, sgst, igst } = splitGst(quote.gstAmount ?? 0, gstType);

  // One lookup for every service in the quote rather than one per item.
  const existing = await tx.serviceUnit.findMany({
    where: { id: { in: items.map((i) => i.itemId) } },
  });
  const serviceById = new Map(existing.map((s) => [s.id, s]));

  // Cart items may reference ids with no catalogue entry (test or
  // dynamically-created services). Create the missing ones up front so the
  // transaction below is pure provisioning.
  for (const item of items) {
    if (serviceById.has(item.itemId)) continue;
    const created = await tx.serviceUnit.create({
      data: {
        id: item.itemId,
        name: item.name || "Service",
        categoryTier1: item.itemId.split("-").slice(0, 2).join("-") || "SF-GEN",
        slug: item.itemId.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        baseWeight: 1,
        sacCode: "998314",
        status: "PUBLISHED",
      },
    });
    serviceById.set(created.id, created);
  }

  const checkoutDetails = quote.checkoutDetails ?? {};
  const milestoneTemplates = getMilestoneTemplates(tier);

  await tx.engagement.create({
    data: {
      id: engId,
      clientId: orgId,
      model: "FPM",
      commercial: {
        subtotal: quote.subtotal,
        gst: quote.gstAmount,
        total: quote.total,
      },
      methodology: "MILESTONE",
      status: "ACTIVE",
      executedAt: quote.paidAt ?? new Date(),
    },
  });

  const projects = [];
  for (const item of items) {
    const service = serviceById.get(item.itemId)!;
    const prefix = item.itemId.split("-").slice(0, 2).join("-");
    const project = await tx.project.create({
      data: {
        id: ids.projectId(prefix),
        name: item.name || service.name,
        engagementId: engId,
        serviceId: item.itemId,
        status: "ACTIVE",
        configSnapshot: item,
      },
    });

    await tx.milestone.createMany({
      data: milestoneTemplates.map((m, i) => ({
        projectId: project.id,
        number: i + 1,
        name: m.name,
        paymentPct: m.pct,
        deliverables: m.deliverables,
      })),
    });

    projects.push(project);
  }

  const contracts = [];
  for (const type of getContractTypes(tier)) {
    const contract = await tx.contract.create({
      data: {
        engagementId: engId,
        type,
        clauseConfig: toJson(checkoutDetails.clauseSelections ?? {}),
        status: checkoutDetails.contractSigned ? "CLIENT_SIGNED" : "DRAFT",
      },
    });

    if (checkoutDetails.contractSigned && checkoutDetails.signatureName) {
      await tx.signature.create({
        data: {
          contractId: contract.id,
          signerUserId: userId,
          side: "CLIENT",
          rail: "CLICK",
          evidence: {
            method: "typed_name",
            name: checkoutDetails.signatureName,
            timestamp: checkoutDetails.signedAt || new Date().toISOString(),
            ip: checkoutDetails.signatureIp || "unknown",
          },
        },
      });
    }

    contracts.push(contract);
  }

  const invoice = await tx.invoice.create({
    data: {
      id: ids.invoiceId(),
      engagementId: engId,
      orgId,
      milestoneRef: "M1",
      sacCode: "998314",
      gstType,
      subtotal: quote.subtotal,
      cgst,
      sgst,
      igst,
      grandTotal: quote.total,
      status: "SENT",
      dueDate: quote.paidAt ?? new Date(),
    },
  });

  await queueInvoiceEmail(tx, invoice.id, "issued", invoice.id);
  return { engId, projects, contracts, invoice };
}

export interface BackfillOptions {
  /** Report what would change and write nothing. Default true — this is destructive. */
  dryRun?: boolean;
  /**
   * Permit the branch that DELETES an org's invoices, contracts and engagements
   * before re-provisioning. Off by default: the deletion is scoped to the whole
   * org rather than to the quote, so an unrelated engagement for the same client
   * is in range. Only enable after reviewing a dry run.
   */
  allowDestructive?: boolean;
}

/**
 * One-off migration for quotes that were paid before provisioning existed.
 *
 * This used to run on every API boot from server.ts. It must not: the branch
 * below deletes commercial records, and its trigger condition — an org whose
 * engagements have no projects attached — is reachable in normal operation,
 * because /checkout/:sid/complete skips services it cannot resolve.
 *
 * Run it deliberately via apps/api/scripts/backfill-paid-quotes.mts.
 */
export async function backfillPaidQuotes(opts: BackfillOptions = {}) {
  if (opts.dryRun === false) {
    throw new Error(
      "Legacy paid quotes require gateway reconciliation; automatic backfill writes are disabled",
    );
  }
  const dryRun = opts.dryRun ?? true;
  const allowDestructive = opts.allowDestructive ?? false;
  if (dryRun) log().info("backfill dry run — no writes will be made");

  const paidQuotes = await prisma.quote.findMany({ where: { status: "paid" } });
  for (const quote of paidQuotes) {
    const orgId = await ensurePersonalOrg(quote.userId);

    // Check if this quote already has a provisioned engagement (by looking at engagements
    // for this org that have projects matching the quote's items)
    const existingEngs = await prisma.engagement.findMany({
      where: { clientId: orgId },
      include: {
        projects: { select: { id: true } },
        contracts: { select: { id: true } },
      },
    });

    // If any engagement for this org already has projects, check if contracts are missing
    const hasProjects = existingEngs.some((e) => e.projects.length > 0);
    if (hasProjects) {
      // Backfill contracts for engagements that have projects but no contracts
      for (const eng of existingEngs) {
        if (eng.projects.length > 0 && eng.contracts.length === 0) {
          const tier = quote.tier || "GROWTH";
          const contractTypes = getContractTypes(tier);
          const checkoutDetails = (quote.checkoutDetails as any) ?? {};
          if (dryRun) {
            log().info(
              {
                contracts: contractTypes.length,
                engagementId: eng.id,
                quote: quote.quoteNumber,
              },
              "backfill would add contracts",
            );
            continue;
          }
          for (const type of contractTypes) {
            await prisma.contract.create({
              data: {
                engagementId: eng.id,
                type,
                clauseConfig: toJson(checkoutDetails.clauseSelections ?? {}),
                status: checkoutDetails.contractSigned ? "CLIENT_SIGNED" : "DRAFT",
              },
            });
          }
          log().info(
            { engagementId: eng.id, quote: quote.quoteNumber },
            "backfilled contracts",
          );
        }
      }
      continue;
    }

    // If there are engagements but none have projects, the previous backfill created
    // empty engagements. Delete them so we can create a proper one.
    if (existingEngs.length && !allowDestructive) {
      log().warn(
        { quote: quote.quoteNumber, orgId, engagements: existingEngs.length },
        "skipped: re-provisioning would delete existing invoices and contracts; " +
          "pass --allow-destructive after reviewing",
      );
      continue;
    }

    if (dryRun) {
      log().info(
        { engagements: existingEngs.length, orgId, quote: quote.quoteNumber },
        "backfill would delete engagements and re-provision",
      );
      continue;
    }

    for (const eng of existingEngs) {
      const [invoices, contracts] = await Promise.all([
        prisma.invoice.count({ where: { engagementId: eng.id } }),
        prisma.contract.count({ where: { engagementId: eng.id } }),
      ]);
      // Destructive and irreversible: this line is the only record that it
      // happened, so it belongs in the log stream rather than on a terminal.
      log().warn(
        { engagementId: eng.id, invoices, contracts },
        "DELETING engagement and its invoices and contracts",
      );
      await prisma.invoice.deleteMany({ where: { engagementId: eng.id } });
      await prisma.contract.deleteMany({ where: { engagementId: eng.id } });
      await prisma.engagement.delete({ where: { id: eng.id } });
    }

    try {
      throw new Error(
        "Legacy paid quotes require gateway evidence; automatic provisioning is disabled",
      );
      log().info(
        { quote: quote.quoteNumber },
        "backfilled quote: engagement, projects and contracts created",
      );
    } catch (err) {
      log().error({ err, quote: quote.quoteNumber }, "failed to backfill quote");
    }
  }
}

export async function quoteRoutes(app: FastifyInstance) {
  app.get("/quotes", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const q = req.query as Record<string, string>;
    const { page: p, limit: l, skip } = pageParams(q);

    // Admins manage every quote; regular users only see their own.
    // Goes through isAdminRole() rather than a bare === "ADMIN" so the legacy
    // lowercase "admin" still present in older rows is normalised too.
    const isAdmin = isAdminRole(req.user!.role);
    const where = isAdmin ? {} : { userId: req.user!.sub };

    const [quotes, total] = await Promise.all([
      prisma.quote.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: l,
      }),
      prisma.quote.count({ where }),
    ]);

    let serialized = quotes.map(serializeQuote);
    if (isAdmin) {
      const userIds = [...new Set(quotes.map((q) => q.userId))];
      const users = await prisma.user.findMany({
        take: LIST_CAP,
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true, phone: true },
      });
      const byId = new Map(users.map((u) => [u.id, u]));
      serialized = serialized.map((q) => ({
        ...q,
        client:
          q.userId === req.user!.sub
            ? null
            : byId.get(q.userId)
              ? { ...byId.get(q.userId)!, _id: q.userId }
              : { _id: q.userId, name: "Unknown user", email: "", phone: "" },
      }));
    }

    return paginated(serialized, total, p, l);
  });

  app.get("/quotes/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { id } = req.params as { id: string };
    const quote = await prisma.quote.findUnique({ where: { id } });
    if (!quote || quote.userId !== req.user!.sub) {
      return reply.code(404).send({ message: "Quote not found" });
    }
    return { data: serializeQuote(quote) };
  });

  app.post("/quotes", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const userId = req.user!.sub;
    const body = parseBody(req, reply, QuoteFromCartSchema);
    if (!body) return;
    const tier = body.tier ?? "GROWTH";

    // Re-priced from the catalogue, never from the request. This previously
    // summed `i.price * i.quantity` using the price the client sent, and a
    // quote's total becomes the grandTotal of a real Invoice via
    // provisionQuote — so a self-declared price became a self-declared bill.
    // The cart has always discarded the client price; this now matches it.
    const items: QuoteItem[] = [];
    for (const raw of body.items) {
      const priced = await catalogPrice(raw.itemId, raw.itemType ?? "service");
      if (!priced) {
        return reply.code(400).send({
          message: `We could not price "${raw.itemId}". Remove it and try again.`,
        });
      }
      items.push({
        name: priced.name,
        price: Math.round(priced.price * 100),
        quantity: raw.quantity ?? 1,
        itemId: raw.itemId,
        itemType: raw.itemType,
      });
    }

    const rawSubtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const subtotal = applyTierMultiplier(rawSubtotal, tier);
    const gstAmount = Math.round(subtotal * 0.18);
    const now = new Date();
    const validUntil = new Date(
      now.getTime() + (tier === "STARTER" ? 30 : 15) * 24 * 60 * 60 * 1000,
    );

    const quote = await prisma.quote.create({
      data: {
        quoteNumber: `SF-Q-${randomUUID()}`,
        userId,
        items: toJson(items),
        subtotal,
        gstAmount,
        total: subtotal + gstAmount,
        tier,
        estimateRange: computeEstimateRange(subtotal, tier) as any,
        status: "draft",
        validUntil,
      },
    });

    return { data: { quote: serializeQuote(quote) } };
  });

  // PATCH /quotes/:id — save checkout wizard step data (account/engagement/payment-terms)
  app.patch("/quotes/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { id } = req.params as { id: string };
    const updBody = parseBody(req, reply, UpdateQuoteSchema);
    if (!updBody) return;
    const { checkoutDetails, tier } = updBody;

    const existing = await prisma.quote.findUnique({ where: { id } });
    if (!existing || existing.userId !== req.user!.sub) {
      return reply.code(404).send({ message: "Quote not found" });
    }

    if (
      ["paid", "cancelled", "partially_paid"].includes(existing.status) ||
      existing.razorpayOrderId ||
      existing.validUntil < new Date()
    )
      return reply
        .code(409)
        .send({ error: "Quote is locked; create a new quote to change details" });
    if (tier && tier !== existing.tier)
      return reply.code(409).send({ error: "Create a new quote to change pricing tier" });
    const data: any = { status: "checkout" };
    if (checkoutDetails) {
      data.checkoutDetails = {
        ...(existing.checkoutDetails as any),
        ...checkoutDetails,
        ...(checkoutDetails.contractSigned
          ? { signatureIp: req.ip, signedAt: new Date().toISOString() }
          : {}),
      };
    }
    if (tier && ["STARTER", "GROWTH", "PREMIUM"].includes(tier)) {
      data.tier = tier;
      data.estimateRange = computeEstimateRange(Number(existing.subtotal), tier) as any;
    }

    const quote = await prisma.quote.update({ where: { id }, data });
    return { data: serializeQuote(quote) };
  });

  app.patch("/quotes/:id/status", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { id } = req.params as { id: string };
    const statusBody = parseBody(req, reply, UpdateQuoteStatusSchema);
    if (!statusBody) return;
    const { status } = statusBody;

    // Only admins drive the sales workflow; owners may just cancel their own quote.
    // Goes through isAdminRole() rather than a bare === "ADMIN" so the legacy
    // lowercase "admin" still present in older rows is normalised too.
    const isAdmin = isAdminRole(req.user!.role);
    const ALLOWED = ["draft", "reviewing", "approved", "invoiced", "cancelled"];
    if (!isAdmin && !(status === "cancelled")) {
      return reply
        .code(403)
        .send({ error: "Only admins can update quote workflow status" });
    }
    if (!ALLOWED.includes(status)) {
      return reply
        .code(400)
        .send({ error: `Invalid status. Allowed: ${ALLOWED.join(", ")}` });
    }

    const existing = await prisma.quote.findUnique({ where: { id } });
    if (!existing || (!isAdmin && existing.userId !== req.user!.sub)) {
      return reply.code(404).send({ error: "Quote not found" });
    }
    if (
      existing.status === "paid" ||
      existing.status === "partially_paid" ||
      existing.razorpayOrderId
    )
      return reply
        .code(409)
        .send({ error: "Payment-bound quote cannot change workflow status" });
    const quote = await prisma.quote.update({ where: { id }, data: { status } });
    await emitEvent({
      code: "QUOTE_STATUS_CHANGED",
      payload: { quoteId: id, status },
      actor: req.user!.sub,
    });
    return { data: serializeQuote(quote) };
  });

  // POST /quotes/:id/pay — create a Razorpay order for the final checkout step.
  app.post("/quotes/:id/pay", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { id } = req.params as { id: string };
    const payBody = parseBody(req, reply, QuotePaySchema);
    if (!payBody) return;
    const { paymentMode } = payBody;
    return prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM quotes WHERE id = ${id} FOR UPDATE`;
        const quote = await tx.quote.findUnique({ where: { id } });
        if (!quote || quote.userId !== req.user!.sub) {
          return reply.code(404).send({ message: "Quote not found" });
        }

        if (quote.status === "cancelled" || quote.validUntil < new Date())
          return reply.code(409).send({ error: "Quote is cancelled or expired" });
        const details = (quote.checkoutDetails as any) ?? {};
        assertPaymentInitiationEnabled();
        if (quote.razorpayOrderId && Number(details.pendingOrderAmount) > 0)
          return {
            data: {
              orderId: quote.razorpayOrderId,
              amount: details.pendingOrderAmount,
              currency: "INR",
              keyId: process.env.RAZORPAY_KEY_ID,
              quoteId: quote.id,
              quoteNumber: quote.quoteNumber,
            },
          };
        const amountPaidSoFar: number = details.amountPaid ?? 0;
        const quoteTotal = Number(quote.total);
        const remainingDue = quoteTotal - amountPaidSoFar;
        if (quote.status === "paid" || remainingDue <= 0) {
          return reply.code(400).send({ message: "This quote has already been paid." });
        }

        // The payment-terms split only applies to the first payment on a quote.
        // Once a milestone/upfront payment has landed, whatever is left is due in
        // full — there is no further installment schedule to compute against.
        let mode = ["MILESTONE", "UPFRONT", "FULL"].includes(paymentMode ?? "")
          ? paymentMode!
          : "FULL";
        if (amountPaidSoFar > 0) {
          mode = "FULL";
        }
        const terms = quotePaymentTerms(
          Number(quote.subtotal),
          quoteTotal,
          amountPaidSoFar,
          mode,
        );
        const amount = terms.amount;

        let order;
        try {
          order = await createRazorpayOrder(amount, "INR", `quote_${quote.id}`, {
            quoteId: quote.id,
            paymentMode: mode,
          });
        } catch (err: any) {
          const description: string | undefined = err?.error?.description ?? err?.message;
          const statusCode: number | undefined = err?.statusCode;
          req.log.error(
            { razorpayError: err?.error ?? err, statusCode },
            "Razorpay order creation failed",
          );
          const authFailure =
            statusCode === 401 || /key_id|key_secret|auth/i.test(description ?? "");
          // A 401 here is the GATEWAY refusing our credentials (or none being
          // configured), not the caller's session. The web client treats any
          // 401 as an expired login and signs the user out, so a payment
          // outage logged every payer out. Report it as unavailable instead,
          // and keep a deliberate status (e.g. the live-payments gate's 503).
          const status = authFailure
            ? 503
            : statusCode && statusCode >= 400 && statusCode < 600
              ? statusCode
              : 500;
          return reply.code(status).send({
            // The detail (missing keys, gateway wording) is in the log above;
            // a customer cannot act on an environment-variable name.
            message: authFailure
              ? "Payments are temporarily unavailable. Please try again shortly."
              : (description ?? "Failed to create Razorpay order"),
          });
        }

        await tx.quote.update({
          where: { id },
          data: {
            razorpayOrderId: order.id,
            status: "checkout",
            subtotal: terms.subtotal,
            gstAmount: terms.gstAmount,
            total: terms.total,
            checkoutDetails: {
              ...details,
              pendingOrderAmount: amount,
              paymentMode: mode,
              ...(mode === "UPFRONT"
                ? { originalTotal: quoteTotal, discount: quoteTotal - terms.total }
                : {}),
            },
          },
        });

        return {
          data: {
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            keyId: process.env.RAZORPAY_KEY_ID,
            quoteId: quote.id,
            quoteNumber: quote.quoteNumber,
          },
        };
      },
      { timeout: 30000, maxWait: 10000 },
    );
  });

  // POST /quotes/:id/verify — verify signature, mark paid, and provision engagement/projects
  app.post("/quotes/:id/verify", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { id } = req.params as { id: string };
    const verifyBody = parseBody(req, reply, QuoteVerifyPaymentSchema);
    if (!verifyBody) return;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = verifyBody;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return reply.code(400).send({
        message:
          "razorpay_order_id, razorpay_payment_id and razorpay_signature are all required",
      });
    }

    const quote = await prisma.quote.findUnique({ where: { id } });
    if (!quote || quote.userId !== req.user!.sub) {
      return reply.code(404).send({ message: "Quote not found" });
    }
    if (quote.razorpayOrderId !== razorpay_order_id) {
      return reply.code(400).send({ message: "Order does not match this quote" });
    }

    if (
      !verifyRazorpaySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)
    )
      return reply.code(400).send({ message: "Signature verification failed" });
    const captured = await fetchCapturedPayment(razorpay_payment_id, razorpay_order_id);
    const updated = await settleQuote(
      id,
      razorpay_order_id,
      razorpay_payment_id,
      captured.amount,
    );
    return { data: serializeQuote(updated) };
  });
}

/** Shared callback/webhook settlement. Provisioning and capture commit together. */
export async function settleQuote(
  quoteId: string,
  orderId: string,
  paymentId: string,
  amount: number,
) {
  if (!Number.isSafeInteger(amount) || amount <= 0)
    throw new Error("Invalid captured amount");
  const quote = await prisma.quote.findUniqueOrThrow({ where: { id: quoteId } });
  const orgId = await ensurePersonalOrg(quote.userId);
  const result = await prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM quotes WHERE id = ${quoteId} FOR UPDATE`;
      const current = await tx.quote.findUniqueOrThrow({ where: { id: quoteId } });
      const prior = await tx.payment.findFirst({
        where: { gateway: "RAZORPAY", gatewayPaymentId: paymentId },
      });
      if (prior) {
        if (prior.invoiceId !== current.invoiceId || Number(prior.amount) !== amount)
          throw new Error("Payment reference mismatch");
        return { quote: current, fx: null };
      }
      const details = (current.checkoutDetails as any) ?? {};
      if (
        current.razorpayOrderId !== orderId ||
        Number(details.pendingOrderAmount) !== amount
      )
        throw new Error("Captured amount/order does not match quote");
      const provisioned = current.invoiceId
        ? null
        : await provisionQuote(current, current.userId, tx, orgId);
      const invoiceId = current.invoiceId ?? provisioned!.invoice.id;
      await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${invoiceId} FOR UPDATE`;
      const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
      const amountPaid = Number(invoice.amountPaid) + amount;
      const paid = amountPaid >= Number(current.total);
      const updatedInvoice = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          amountPaid,
          status: paid ? "PAID" : "PARTIALLY_PAID",
          paidAt: paid ? new Date() : null,
          utr: paymentId,
        },
      });
      const fx = await recordInvoicePaymentRows(tx, updatedInvoice, {
        gateway: "RAZORPAY",
        gatewayPaymentId: paymentId,
        gatewayOrderId: orderId,
        amount,
      });
      const updated = await tx.quote.update({
        where: { id: quoteId },
        data: {
          invoiceId,
          status: paid ? "paid" : "partially_paid",
          paidAt: paid ? new Date() : null,
          checkoutDetails: toJson({
            ...details,
            amountPaid,
            payments: [...(details.payments ?? []), paymentId],
            pendingOrderAmount: 0,
          }),
        },
      });
      return { quote: updated, fx };
    },
    { timeout: 30000, maxWait: 10000 },
  );
  if (result.fx) {
    await enqueuePaymentSideEffects(result.fx);
    await emitEvent({
      code: result.quote.status === "paid" ? "INVOICE_PAID" : "INVOICE_PARTIALLY_PAID",
      actor: "SYSTEM",
      engagementId: result.fx.engagementId ?? undefined,
      payload: { invoiceId: result.fx.invoiceId, quoteId, amount },
    });
  }
  return result.quote;
}
