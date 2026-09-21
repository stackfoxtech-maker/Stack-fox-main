import type { FastifyInstance } from "fastify";
import { prisma } from "@stackfox/prisma";
import { requireAuth } from "../plugins/auth";
import { applyTierMultiplier, computeEstimateRange } from "../lib/estimate";
import { createRazorpayOrder, verifyRazorpaySignature } from "../lib/payments";
import { getContractTypes, getMilestoneTemplates, isAdminRole, paymentModeAmount } from "@stackfox/core";
import { emitEvent } from "../lib/events";
import { toJson } from "../lib/json";
import { LIST_CAP, pageParams, paginated } from "../lib/http";
import { ensurePersonalOrg } from "../lib/scope";
import * as ids from "../lib/id";
import { resolveGstType, splitGst } from "../lib/gst";
import { log } from "../lib/logger";

interface QuoteItem {
  name: string;
  price: number;
  quantity: number;
  itemId?: string;
  itemType?: string;
}

function serializeQuote(q: any) {
  return { ...q, _id: q.id };
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
async function provisionQuote(quote: any, userId: string) {
  const orgId = await ensurePersonalOrg(userId);
  const items = ((quote.items as any[]) || []).filter((i) => i?.itemId);
  const tier = quote.tier || "GROWTH";
  const engId = ids.engagementId();

  // Resolve the tax treatment from the billing org, exactly as checkout does.
  const billTo = await prisma.org.findUnique({ where: { id: orgId } });
  const gstType = resolveGstType(billTo);
  const { cgst, sgst, igst } = splitGst(quote.gstAmount ?? 0, gstType);

  // One lookup for every service in the quote rather than one per item.
  const existing = await prisma.serviceUnit.findMany({
    where: { id: { in: items.map((i) => i.itemId) } },
  });
  const serviceById = new Map(existing.map((s) => [s.id, s]));

  // Cart items may reference ids with no catalogue entry (test or
  // dynamically-created services). Create the missing ones up front so the
  // transaction below is pure provisioning.
  for (const item of items) {
    if (serviceById.has(item.itemId)) continue;
    const created = await prisma.serviceUnit.create({
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

  const checkoutDetails = (quote.checkoutDetails) ?? {};
  const milestoneTemplates = getMilestoneTemplates(tier);

  const result = await prisma.$transaction(
    async (tx) => {
      await tx.engagement.create({
        data: {
          id: engId,
          clientId: orgId,
          model: "FPM",
          commercial: { subtotal: quote.subtotal, gst: quote.gstAmount, total: quote.total },
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
          status: "PAID",
          paidAt: quote.paidAt ?? new Date(),
          dueDate: quote.paidAt ?? new Date(),
        },
      });

      return { projects, contracts, invoice };
    },
    { timeout: 30_000, maxWait: 10_000 },
  );

  // Committed — side effects only from here.
  await emitEvent({ code: "ENGAGEMENT_CREATED", payload: { engagementId: engId }, actor: userId, engagementId: engId });
  for (const p of result.projects) {
    await emitEvent({ code: "PROJECT_CREATED", payload: { projectId: p.id }, actor: userId, projectId: p.id, engagementId: engId });
  }
  for (const c of result.contracts) {
    await emitEvent({ code: "CONTRACT_CREATED", payload: { contractId: c.id, type: c.type }, actor: userId, engagementId: engId });
  }
  await emitEvent({ code: "INVOICE_CREATED", payload: { invoiceId: result.invoice.id }, actor: "SYSTEM" });

  return { engId, projects: result.projects, contracts: result.contracts, invoice: result.invoice };
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
      include: { projects: { select: { id: true } }, contracts: { select: { id: true } } },
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
              { contracts: contractTypes.length, engagementId: eng.id, quote: quote.quoteNumber },
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
      await provisionQuote(quote, quote.userId);
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
    // SUPER_ADMIN is an administrator too — a bare === "ADMIN" comparison
    // silently scoped the master admin to their own rows.
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
        client: q.userId === req.user!.sub
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
    const body = req.body as { items?: QuoteItem[]; tier?: string } | undefined;

    const items: QuoteItem[] = body?.items ?? [];
    if (items.length === 0) {
      return reply.code(400).send({ message: "Cart is empty — add items before requesting a quote." });
    }
    const tier = ["STARTER", "GROWTH", "PREMIUM"].includes(body?.tier ?? "") ? body!.tier! : "GROWTH";

    const rawSubtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const subtotal = applyTierMultiplier(rawSubtotal, tier);
    const gstAmount = Math.round(subtotal * 0.18);
    const now = new Date();
    const validUntil = new Date(now.getTime() + (tier === "STARTER" ? 30 : 15) * 24 * 60 * 60 * 1000);

    const seq = (await prisma.quote.count()) + 1;
    const quote = await prisma.quote.create({
      data: {
        quoteNumber: `SF-Q-${String(seq).padStart(4, "0")}`,
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
    const { checkoutDetails, tier } = req.body as { checkoutDetails?: Record<string, unknown>; tier?: string };

    const existing = await prisma.quote.findUnique({ where: { id } });
    if (!existing || existing.userId !== req.user!.sub) {
      return reply.code(404).send({ message: "Quote not found" });
    }

    const data: any = { status: "checkout" };
    if (checkoutDetails) {
      data.checkoutDetails = { ...(existing.checkoutDetails as any), ...checkoutDetails };
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
    const { status } = req.body as { status: string };

    // Only admins drive the sales workflow; owners may just cancel their own quote.
    // SUPER_ADMIN is an administrator too — a bare === "ADMIN" comparison
    // silently scoped the master admin to their own rows.
    const isAdmin = isAdminRole(req.user!.role);
    const ALLOWED = ["draft", "reviewing", "approved", "invoiced", "cancelled"];
    if (!isAdmin && !(status === "cancelled")) {
      return reply.code(403).send({ error: "Only admins can update quote workflow status" });
    }
    if (!ALLOWED.includes(status)) {
      return reply.code(400).send({ error: `Invalid status. Allowed: ${ALLOWED.join(", ")}` });
    }

    const existing = await prisma.quote.findUnique({ where: { id } });
    if (!existing || (!isAdmin && existing.userId !== req.user!.sub)) {
      return reply.code(404).send({ error: "Quote not found" });
    }
    const quote = await prisma.quote.update({ where: { id }, data: { status } });
    await emitEvent({ code: "QUOTE_STATUS_CHANGED", payload: { quoteId: id, status }, actor: req.user!.sub });
    return { data: serializeQuote(quote) };
  });

  // POST /quotes/:id/pay — create a Razorpay order for the final checkout step.
  app.post("/quotes/:id/pay", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { id } = req.params as { id: string };
    const { paymentMode } = req.body as { paymentMode?: string };
    const quote = await prisma.quote.findUnique({ where: { id } });
    if (!quote || quote.userId !== req.user!.sub) {
      return reply.code(404).send({ message: "Quote not found" });
    }

    const details = (quote.checkoutDetails as any) ?? {};
    const amountPaidSoFar: number = details.amountPaid ?? 0;
    const quoteTotal = Number(quote.total);
    const remainingDue = quoteTotal - amountPaidSoFar;
    if (quote.status === "paid" || remainingDue <= 0) {
      return reply.code(400).send({ message: "This quote has already been paid." });
    }

    // The payment-terms split only applies to the first payment on a quote.
    // Once a milestone/upfront payment has landed, whatever is left is due in
    // full — there is no further installment schedule to compute against.
    let mode = ["MILESTONE", "UPFRONT", "FULL"].includes(paymentMode ?? "") ? paymentMode! : "FULL";
    let amount = remainingDue;
    if (amountPaidSoFar === 0) {
      amount = paymentModeAmount(quoteTotal, mode);
    } else {
      mode = "FULL";
    }

    let order;
    try {
      order = await createRazorpayOrder(amount * 100, "INR", `quote_${quote.id}`, { quoteId: quote.id, paymentMode: mode });
    } catch (err: any) {
      const description: string | undefined = err?.error?.description ?? err?.message;
      const statusCode: number | undefined = err?.statusCode;
      req.log.error({ razorpayError: err?.error ?? err, statusCode }, "Razorpay order creation failed");
      const authFailure = statusCode === 401 || /key_id|key_secret|auth/i.test(description ?? "");
      return reply.code(authFailure ? 401 : 500).send({ message: description ?? "Failed to create Razorpay order" });
    }

    await prisma.quote.update({
      where: { id },
      data: {
        razorpayOrderId: order.id,
        status: "checkout",
        checkoutDetails: { ...details, pendingOrderAmount: amount },
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
  });

  // POST /quotes/:id/verify — verify signature, mark paid, and provision engagement/projects
  app.post("/quotes/:id/verify", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { id } = req.params as { id: string };
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body as {
      razorpay_order_id?: string;
      razorpay_payment_id?: string;
      razorpay_signature?: string;
    };

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return reply.code(400).send({ message: "razorpay_order_id, razorpay_payment_id and razorpay_signature are all required" });
    }

    const quote = await prisma.quote.findUnique({ where: { id } });
    if (!quote || quote.userId !== req.user!.sub) {
      return reply.code(404).send({ message: "Quote not found" });
    }
    if (quote.razorpayOrderId !== razorpay_order_id) {
      return reply.code(400).send({ message: "Order does not match this quote" });
    }

    const details = (quote.checkoutDetails as any) ?? {};
    const paidPayments: string[] = details.payments ?? [];
    if (paidPayments.includes(razorpay_payment_id)) {
      // Already recorded — a retried client call, not a fresh payment.
      return { data: serializeQuote(quote) };
    }

    const valid = verifyRazorpaySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    if (!valid) {
      return reply.code(400).send({ message: "Signature verification failed" });
    }

    // The order amount was computed and pinned server-side at /pay time —
    // never trust a client-supplied amount here.
    const orderAmount: number = details.pendingOrderAmount ?? 0;
    const amountPaid = (details.amountPaid ?? 0) + orderAmount;
    const fullyPaid = amountPaid >= quote.total;

    const nextDetails = {
      ...details,
      amountPaid,
      payments: [...paidPayments, razorpay_payment_id],
      pendingOrderAmount: undefined,
    };

    const updated = await prisma.quote.update({
      where: { id },
      data: {
        status: fullyPaid ? "paid" : "partially_paid",
        paidAt: fullyPaid ? new Date() : quote.paidAt,
        checkoutDetails: nextDetails,
      },
    });
    await emitEvent({
      code: fullyPaid ? "QUOTE_PAID" : "QUOTE_PARTIALLY_PAID",
      payload: { quoteId: id, razorpayPaymentId: razorpay_payment_id, amountPaid, total: quote.total },
      actor: req.user!.sub,
    });

    if (fullyPaid) {
      await provisionQuote(updated, req.user!.sub);
    }

    return { data: serializeQuote(updated) };
  });
}


