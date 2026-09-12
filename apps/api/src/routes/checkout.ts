import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "@stackfox/prisma";
import { requireAuth } from "../plugins/auth";
import { emitEvent } from "../lib/events";
import { canonicalHash } from "../lib/hash";
import { createRazorpayOrder, verifyRazorpaySignature } from "../lib/payments";
import { recordInvoicePayment } from "../lib/billing";
import { queues } from "../lib/queue";
import * as ids from "../lib/id";
import { redis, cache } from "../lib/redis";
import { toJson } from "../lib/json";
import { resolveGstType, splitGst } from "../lib/gst";
import { paymentModeAmount } from "@stackfox/core";
import { findCatalogueItem } from "../lib/catalogue";
import { ensurePersonalOrg } from "../lib/scope";

interface CheckoutSession {
  estimateId: string;
  userId: string;
  tier: string;
  step: number;
  accountDetails?: Record<string, unknown>;
  engagementDetails?: Record<string, unknown>;
  paymentTerms?: Record<string, unknown>;
  clauseSelections?: Record<string, unknown>;
  signed?: boolean;
  razorpayOrderId?: string;
}

/**
 * Loads a checkout session by sid, requiring it belong to the authenticated
 * caller — otherwise any logged-in user could read, step through, or convert
 * any other user's active checkout by guessing an sid.
 */
async function loadOwnedSession(
  req: FastifyRequest,
  reply: FastifyReply,
  sid: string,
): Promise<CheckoutSession | undefined> {
  const raw = await redis.get(`checkout:${sid}`);
  if (!raw) {
    reply.code(404).send({ error: "Session not found or expired" });
    return undefined;
  }
  const session: CheckoutSession = JSON.parse(raw);
  if (session.userId !== req.user!.sub) {
    reply.code(404).send({ error: "Session not found or expired" });
    return undefined;
  }
  return session;
}

export async function checkoutRoutes(app: FastifyInstance) {
  // POST /checkout/start — hash guard G-039
  app.post("/checkout/start", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { estimateId } = req.body as { estimateId: string };
    const estimate = await prisma.estimate.findUnique({
      where: { id: estimateId },
      include: { workspace: true },
    });
    if (!estimate) return reply.code(404).send({ error: "Estimate not found" });
    if (estimate.workspace.userId && estimate.workspace.userId !== req.user!.sub) {
      return reply.code(404).send({ error: "Estimate not found" });
    }

    if (estimate.status !== "ACTIVE") {
      return reply.code(409).send({ error: "Estimate is no longer active" });
    }
    if (new Date() > estimate.lockedUntil) {
      await prisma.estimate.update({ where: { id: estimateId }, data: { status: "EXPIRED" } });
      await emitEvent({ code: "ESTIMATE_EXPIRED", payload: { estimateId }, actor: "SYSTEM" });
      return reply.code(410).send({ error: "Estimate has expired. Please regenerate." });
    }

    // G-039: verify hash hasn't drifted
    const ws = estimate.workspace;
    const currentHash = canonicalHash(ws.canvas as any[]);
    if (currentHash !== estimate.hash) {
      await emitEvent({ code: "EST_010", payload: { estimateId, drift: true }, actor: "SYSTEM" });
      return reply.code(409).send({
        error: "Workspace has changed since estimate was generated. Please refresh the estimate.",
        code: "HASH_DRIFT",
      });
    }

    const sid = `ckout_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const session: CheckoutSession = {
      estimateId,
      userId: req.user!.sub,
      tier: (req.body as any).tier ?? "GROWTH",
      step: 1,
    };

    await redis.set(`checkout:${sid}`, JSON.stringify(session), "EX", 3600);

    await emitEvent({
      code: session.tier === "STARTER" ? "EXPRESS_CHECKOUT_STARTED" : "SCOPE_001",
      payload: { sid, estimateId, tier: session.tier },
      actor: req.user?.sub ?? "ANONYMOUS",
    });

    return { sid, session };
  });

  // GET /checkout/:sid/status
  app.get("/checkout/:sid/status", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { sid } = req.params as { sid: string };
    const session = await loadOwnedSession(req, reply, sid);
    if (!session) return;
    return session;
  });

  // PATCH /checkout/:sid/step2 — account details
  app.patch("/checkout/:sid/step2", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { sid } = req.params as { sid: string };
    const session = await loadOwnedSession(req, reply, sid);
    if (!session) return;

    session.accountDetails = req.body as Record<string, unknown>;
    session.step = 2;

    // KYC gate check
    const totals = await getEstimateTotals(session.estimateId);
    if (totals && totals.grand >= 1000000) {
      // ≥₹10L: BO declaration
      (session.accountDetails as any).kycRequired = "BO_DECLARATION";
    }
    if (totals && totals.grand >= 5000000) {
      // ≥₹50L: EDD
      (session.accountDetails as any).kycRequired = "EDD";
    }

    await redis.set(`checkout:${sid}`, JSON.stringify(session), "EX", 3600);
    return session;
  });

  // PATCH /checkout/:sid/step3 — engagement details
  app.patch("/checkout/:sid/step3", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { sid } = req.params as { sid: string };
    const session = await loadOwnedSession(req, reply, sid);
    if (!session) return;

    session.engagementDetails = req.body as Record<string, unknown>;
    session.step = 3;
    await redis.set(`checkout:${sid}`, JSON.stringify(session), "EX", 3600);
    return session;
  });

  // PATCH /checkout/:sid/step4 — payment terms
  app.patch("/checkout/:sid/step4", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { sid } = req.params as { sid: string };
    const session = await loadOwnedSession(req, reply, sid);
    if (!session) return;

    session.paymentTerms = req.body as Record<string, unknown>;
    session.step = 4;
    await redis.set(`checkout:${sid}`, JSON.stringify(session), "EX", 3600);
    return session;
  });

  // PATCH /checkout/:sid/step5 — clause selections
  app.patch("/checkout/:sid/step5", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { sid } = req.params as { sid: string };
    const session = await loadOwnedSession(req, reply, sid);
    if (!session) return;

    session.clauseSelections = req.body as Record<string, unknown>;
    session.step = 5;
    await redis.set(`checkout:${sid}`, JSON.stringify(session), "EX", 3600);

    // Queue contract document generation
    await queues.docGen.add("contracts", {
      type: "checkout-contracts",
      sid,
      tier: session.tier,
      clauseSelections: session.clauseSelections,
      estimateId: session.estimateId,
    });

    return session;
  });

  // POST /checkout/:sid/sign — e-sign
  app.post("/checkout/:sid/sign", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { sid } = req.params as { sid: string };
    const { rail, evidence } = req.body as { rail: string; evidence: Record<string, unknown> };

    const session = await loadOwnedSession(req, reply, sid);
    if (!session) return;
    session.signed = true;
    session.step = 6;
    await redis.set(`checkout:${sid}`, JSON.stringify(session), "EX", 3600);

    return { signed: true, rail };
  });

  // POST /checkout/:sid/pay — create Razorpay order
  app.post("/checkout/:sid/pay", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { sid } = req.params as { sid: string };
    const session = await loadOwnedSession(req, reply, sid);
    if (!session) return;
    const totals = await getEstimateTotals(session.estimateId);
    if (!totals) return reply.code(500).send({ error: "Cannot read estimate totals" });

    const paymentMode = (session.paymentTerms as any)?.mode ?? "MILESTONE";
    const amount = paymentModeAmount(totals.grand, paymentMode);

    const order = await createRazorpayOrder(amount, "INR", `ckout_${sid}`);
    session.razorpayOrderId = order.id;
    await redis.set(`checkout:${sid}`, JSON.stringify(session), "EX", 3600);

    return {
      razorpayOrderId: order.id,
      amount,
      currency: "INR",
      keyId: process.env.RAZORPAY_KEY_ID,
    };
  });

  // POST /checkout/:sid/complete — create order + engagement + projects + contracts
  app.post("/checkout/:sid/complete", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { sid } = req.params as { sid: string };
    const session = await loadOwnedSession(req, reply, sid);
    if (!session) return;
    const estimate = await prisma.estimate.findUnique({ where: { id: session.estimateId } });
    if (!estimate) return reply.code(404).send({ error: "Estimate not found" });

    // Atomically claim the estimate before creating anything: a resubmitted or
    // double-clicked /complete call (or a retried payment) must not create a
    // second order/engagement/invoice set for the same estimate.
    const claim = await prisma.estimate.updateMany({
      where: { id: estimate.id, status: { not: "CONVERTED" } },
      data: { status: "CONVERTED" },
    });
    if (claim.count === 0) {
      return reply.code(409).send({ error: "This estimate has already been converted to an order." });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
    if (!user?.orgId) return reply.code(400).send({ error: "Organization required" });

    const engId = ids.engagementId();
    const ordId = ids.orderId();
    const snapshot = estimate.snapshot as any;
    const totals = estimate.totals as any;

    // Create engagement
    const engagement = await prisma.engagement.create({
      data: {
        id: engId,
        clientId: user.orgId,
        model: (session.engagementDetails as any)?.model ?? "FPM",
        commercial: totals,
        status: "ACTIVE",
        executedAt: new Date(),
      },
    });

    // Create order
    const order = await prisma.order.create({
      data: {
        id: ordId,
        orgId: user.orgId,
        estimateId: estimate.id,
        engagementId: engId,
        projectName: (session.engagementDetails as any)?.projectName ?? "New Project",
        primaryContact: {
          name: user.name,
          email: user.email,
          phone: user.phone,
        },
        paymentMode: (session.paymentTerms as any)?.mode ?? "MILESTONE",
        clauseConfig: toJson(session.clauseSelections ?? {}),
        tier: session.tier,
        referralCode: (req.body as any)?.referralCode,
        status: "ACCEPTED",
      },
    });

    // Create projects for each service in canvas
    const canvas = snapshot.canvas as any[];
    const projects = [];
    for (const item of canvas) {
      const service = await prisma.serviceUnit.findUnique({ where: { id: item.serviceId } });
      if (!service) continue;

      const prefix = service.id.split("-").slice(0, 2).join("-");
      const project = await prisma.project.create({
        data: {
          id: ids.projectId(prefix),
          engagementId: engId,
          orderId: ordId,
          serviceId: item.serviceId,
          status: "ACTIVE",
          configSnapshot: item,
          pmUserId: null, // Assigned later by PM
        },
      });

      // Create default milestones
      const milestoneTemplates = getMilestoneTemplates(session.tier);
      for (let i = 0; i < milestoneTemplates.length; i++) {
        await prisma.milestone.create({
          data: {
            projectId: project.id,
            number: i + 1,
            name: milestoneTemplates[i].name,
            paymentPct: milestoneTemplates[i].pct,
            deliverables: milestoneTemplates[i].deliverables,
          },
        });
      }

      projects.push(project);
    }

    // Create contracts
    const contractTypes = getContractTypes(session.tier);
    for (const type of contractTypes) {
      const contract = await prisma.contract.create({
        data: {
          orderId: ordId,
          engagementId: engId,
          type,
          clauseConfig: toJson(session.clauseSelections ?? {}),
          status: session.signed ? "CLIENT_SIGNED" : "DRAFT",
        },
      });

      // Queue doc generation
      await queues.docGen.add("contract-pdf", {
        type: "contract",
        contractId: contract.id,
        contractType: type,
      });
    }

    // Generate first invoice
    const invoiceAmount = paymentModeAmount(totals.grand, (session.paymentTerms as any)?.mode ?? "MILESTONE");

    const billTo = await prisma.org.findUnique({ where: { id: user.orgId } });
    const gstType = resolveGstType(billTo);
    const gstRate = 0.18;
    const subtotal = Math.round(invoiceAmount / (1 + gstRate));
    const { cgst, sgst, igst } = splitGst(invoiceAmount - subtotal, gstType);

    const invoice = await prisma.invoice.create({
      data: {
        id: ids.invoiceId(),
        orderId: ordId,
        engagementId: engId,
        orgId: user.orgId,
        milestoneRef: "M1",
        sacCode: "998314",
        gstType,
        subtotal,
        cgst,
        sgst,
        igst,
        grandTotal: invoiceAmount,
        status: "SENT",
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // The first invoice used to be created with no document behind it, so the
    // client panel had nothing to download for it.
    await queues.docGen
      .add("invoice-pdf", { type: "invoice", invoiceId: invoice.id })
      .catch(() => {});

    // Payment capture. The client posts the Razorpay handshake from the
    // checkout `/pay` step; verify it and settle the first invoice. Without a
    // handshake the invoice stays SENT (pay-later / bank-transfer path).
    const pay = req.body as {
      razorpay_order_id?: string;
      razorpay_payment_id?: string;
      razorpay_signature?: string;
    };
    if (pay?.razorpay_payment_id && pay?.razorpay_signature) {
      const orderId = pay.razorpay_order_id ?? session.razorpayOrderId;
      const valid =
        !!orderId &&
        verifyRazorpaySignature(orderId, pay.razorpay_payment_id, pay.razorpay_signature);
      if (!valid) {
        return reply.code(400).send({ error: "Payment signature verification failed" });
      }
      const paidInvoice = await prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: "PAID", paidAt: new Date(), utr: pay.razorpay_payment_id },
      });
      await recordInvoicePayment(paidInvoice, {
        gateway: "RAZORPAY",
        gatewayPaymentId: pay.razorpay_payment_id,
        gatewayOrderId: orderId,
      });
      await emitEvent({
        code: "INVOICE_PAID",
        payload: { invoiceId: invoice.id, gateway: "razorpay", razorpayPaymentId: pay.razorpay_payment_id },
        actor: req.user!.sub,
        engagementId: engId,
      });
    }

    // Emit events
    await emitEvent({ code: "ESTIMATE_CONVERTED", payload: { estimateId: estimate.id }, actor: req.user!.sub });
    await emitEvent({ code: "ORDER_PLACED", payload: { orderId: ordId, tier: session.tier }, actor: req.user!.sub });
    await emitEvent({ code: "ENGAGEMENT_CREATED", payload: { engagementId: engId }, actor: req.user!.sub, engagementId: engId });
    await emitEvent({ code: "INVOICE_CREATED", payload: { invoiceId: invoice.id }, actor: "SYSTEM" });

    for (const p of projects) {
      await emitEvent({ code: "PROJECT_CREATED", payload: { projectId: p.id }, actor: req.user!.sub, projectId: p.id, engagementId: engId });
    }

    // Clean up checkout session
    await redis.del(`checkout:${sid}`);

    // Handle referral
    if ((req.body as any)?.referralCode) {
      await queues.referralProcessor.add("convert", {
        referralCode: (req.body as any).referralCode,
        orderId: ordId,
      });
    }

    return { order, engagement, projects, invoice };
  });

  // POST /checkout/express — Starter tier 3-field checkout
  app.post("/checkout/express", async (req, reply) => {
    const { name, phone, email, packageId, addOns } = req.body as {
      name?: string;
      phone?: string;
      email?: string;
      packageId?: string;
      addOns?: string[];
    };
    if (!name?.trim() || !phone?.trim() || !email?.trim() || !packageId) {
      return reply.code(400).send({ error: "name, phone, email and packageId are required" });
    }

    // The public storefront (and this page) is built against the JSON
    // catalogue, not the ServiceUnit/Package DB tables — a lookup against
    // prisma.package here would 404 on every real packageId a customer could
    // actually send.
    const pkg = findCatalogueItem(packageId);
    if (!pkg || pkg.type !== "package") return reply.code(404).send({ error: "Package not found" });

    const addOnItems: { id: string; name: string; price: number }[] = [];
    for (const addOnId of addOns ?? []) {
      const item = findCatalogueItem(addOnId);
      if (item && item.type === "addon") addOnItems.push({ id: item.id, name: item.name, price: item.price });
    }

    const subtotal = pkg.price + addOnItems.reduce((s, a) => s + a.price, 0); // rupees
    const gst = Math.round(subtotal * 0.18);
    const total = subtotal + gst; // rupees

    // Create or find user
    let user = await prisma.user.findFirst({
      where: { OR: [{ email }, { phone }] },
    });
    if (!user) {
      user = await prisma.user.create({
        data: { name, email, phone, role: "INDIVIDUAL_CLIENT" },
      });
    }

    const rzpOrder = await createRazorpayOrder(total * 100, "INR", `express_${packageId}`, {
      packageId,
      userId: user.id,
    });

    // Stash the server-priced details keyed by the Razorpay order id; /verify
    // reads these back instead of trusting anything the client sends at
    // confirmation time.
    await redis.set(
      `express:${rzpOrder.id}`,
      JSON.stringify({
        userId: user.id,
        packageId,
        packageName: pkg.name,
        packagePrice: pkg.price,
        addOns: addOnItems,
        subtotal,
        gst,
        total,
        name,
        email,
        phone,
      }),
      "EX",
      3600,
    );

    await emitEvent({
      code: "EXPRESS_CHECKOUT_STARTED",
      payload: { packageId, userId: user.id, total },
      actor: user.id,
    });

    return {
      razorpayOrderId: rzpOrder.id,
      amount: total * 100,
      currency: "INR",
      keyId: process.env.RAZORPAY_KEY_ID,
      userId: user.id,
    };
  });

  // POST /checkout/express/verify — verify signature, then provision order +
  // engagement + project + milestones + contract + invoice, same shape as the
  // full wizard's /complete but for the Starter tier's 3-field flow.
  app.post("/checkout/express/verify", async (req, reply) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body as {
      razorpay_order_id?: string;
      razorpay_payment_id?: string;
      razorpay_signature?: string;
    };
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return reply.code(400).send({ error: "razorpay_order_id, razorpay_payment_id and razorpay_signature are all required" });
    }

    const key = `express:${razorpay_order_id}`;

    // Serialize concurrent/duplicate verify calls for the same order. The
    // session is only deleted once every write below has committed, so a
    // retry after a transient failure can still complete the same order
    // instead of a charged customer ending up with no order and a 404 on
    // every subsequent attempt.
    const locked = await cache.lock(key, 30000);
    if (!locked) {
      return reply.code(409).send({ error: "This payment is already being processed. Please wait a moment and refresh." });
    }

    try {
      const raw = await redis.get(key);
      if (!raw) {
        const existing = await prisma.order.findFirst({ where: { razorpayOrderId: razorpay_order_id } });
        if (existing) return { orderId: existing.id };
        return reply.code(404).send({ error: "Checkout session not found or expired" });
      }

      const valid = verifyRazorpaySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
      if (!valid) return reply.code(400).send({ error: "Payment signature verification failed" });

      const pending = JSON.parse(raw) as {
        userId: string;
        packageId: string;
        packageName: string;
        packagePrice: number;
        addOns: { id: string; name: string; price: number }[];
        subtotal: number;
        gst: number;
        total: number;
        name: string;
        email: string;
        phone: string;
      };

      const user = await prisma.user.findUnique({ where: { id: pending.userId } });
      if (!user) return reply.code(404).send({ error: "Customer record not found" });
      const orgId = await ensurePersonalOrg(user.id);

      // pending.* are rupees (the catalogue's unit); Order/Invoice/Payment are paise.
      const subtotalPaise = pending.subtotal * 100;
      const gstPaise = pending.gst * 100;
      const totalPaise = pending.total * 100;

      const billTo = await prisma.org.findUnique({ where: { id: orgId } });
      const gstType = resolveGstType(billTo);
      const { cgst, sgst, igst } = splitGst(gstPaise, gstType);

      // All writes below commit together or not at all — a partial failure
      // (e.g. the invoice create throwing after the order was created) must
      // never leave an orphaned engagement/order behind with nothing to show
      // for the customer's payment, nor duplicate rows on the next retry.
      const { engId, order, project, invoice } = await prisma.$transaction(async (tx) => {
        const engId = ids.engagementId();
        await tx.engagement.create({
          data: {
            id: engId,
            clientId: orgId,
            model: "FPM",
            commercial: { subtotal: pending.subtotal, gst: pending.gst, total: pending.total },
            methodology: "MILESTONE",
            status: "ACTIVE",
            executedAt: new Date(),
          },
        });

        const order = await tx.order.create({
          data: {
            id: ids.orderId(),
            orgId,
            engagementId: engId,
            services: [pending.packageId, ...pending.addOns.map((a) => a.id)],
            subtotal: subtotalPaise,
            gst: gstPaise,
            grandTotal: totalPaise,
            razorpayOrderId: razorpay_order_id,
            tier: "STARTER",
            paymentMode: "FULL",
            primaryContact: { name: pending.name, email: pending.email, phone: pending.phone },
            status: "PAID",
            paidAt: new Date(),
          },
        });

        // Project.serviceId is a required FK to ServiceUnit, but express-checkout
        // packages live in the JSON catalogue, not that table — ensure a
        // placeholder row exists, same as the quotes flow does for the same reason.
        let service = await tx.serviceUnit.findUnique({ where: { id: pending.packageId } });
        if (!service) {
          service = await tx.serviceUnit.create({
            data: {
              id: pending.packageId,
              name: pending.packageName,
              categoryTier1: "SF-EXP",
              slug: pending.packageId.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
              baseWeight: 1,
              sacCode: "998314",
              status: "PUBLISHED",
            },
          });
        }

        const prefix = (pending.packageId.split("-").slice(0, 2).join("-") || "SF-EXP").toUpperCase();
        const project = await tx.project.create({
          data: {
            id: ids.projectId(prefix),
            engagementId: engId,
            orderId: order.id,
            serviceId: service.id,
            name: pending.packageName,
            status: "ACTIVE",
            configSnapshot: { packageId: pending.packageId, addOns: pending.addOns },
          },
        });
        for (const m of getMilestoneTemplates("STARTER")) {
          await tx.milestone.create({
            data: { projectId: project.id, number: 1, name: m.name, paymentPct: m.pct, deliverables: m.deliverables },
          });
        }

        for (const type of getContractTypes("STARTER")) {
          await tx.contract.create({
            data: { orderId: order.id, engagementId: engId, type, status: "DRAFT" },
          });
        }

        const invoice = await tx.invoice.create({
          data: {
            id: ids.invoiceId(),
            orderId: order.id,
            engagementId: engId,
            orgId,
            milestoneRef: "M1",
            sacCode: "998314",
            gstType,
            subtotal: subtotalPaise,
            cgst,
            sgst,
            igst,
            grandTotal: totalPaise,
            status: "PAID",
            paidAt: new Date(),
            dueDate: new Date(),
          },
        });

        return { engId, order, project, invoice };
      });

      // Everything committed — safe to release the session and fire the
      // side effects (queues, payment ledger, events) that don't need to be
      // atomic with the DB rows themselves.
      await redis.del(key);

      const contracts = await prisma.contract.findMany({ where: { orderId: order.id }, select: { id: true, type: true } });
      for (const contract of contracts) {
        await queues.docGen.add("contract-pdf", { type: "contract", contractId: contract.id, contractType: contract.type });
      }
      await queues.docGen.add("invoice-pdf", { type: "invoice", invoiceId: invoice.id }).catch(() => {});

      await recordInvoicePayment(invoice, {
        gateway: "RAZORPAY",
        gatewayPaymentId: razorpay_payment_id,
        gatewayOrderId: razorpay_order_id,
        amount: totalPaise,
      });

      await emitEvent({ code: "ORDER_PLACED", payload: { orderId: order.id, tier: "STARTER" }, actor: user.id });
      await emitEvent({ code: "ENGAGEMENT_CREATED", payload: { engagementId: engId }, actor: user.id, engagementId: engId });
      await emitEvent({ code: "PROJECT_CREATED", payload: { projectId: project.id }, actor: user.id, projectId: project.id, engagementId: engId });
      await emitEvent({
        code: "INVOICE_PAID",
        payload: { invoiceId: invoice.id, gateway: "razorpay", razorpayPaymentId: razorpay_payment_id },
        actor: user.id,
        engagementId: engId,
      });

      return { orderId: order.id };
    } finally {
      await cache.unlock(key);
    }
  });

  // GET /checkout/express/confirmation/:orderId — unauthenticated receipt lookup.
  // Express checkout customers have no login session, so this can't require
  // auth; it only ever returns non-sensitive receipt fields, never the full
  // order/contact record.
  app.get("/checkout/express/confirmation/:orderId", async (req, reply) => {
    const { orderId } = req.params as { orderId: string };
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { projects: true },
    });
    if (!order || order.tier !== "STARTER") return reply.code(404).send({ error: "Order not found" });

    const contact = (order.primaryContact as any) ?? {};
    return {
      confirmation: {
        orderNumber: order.id,
        customerName: contact.name ?? null,
        items: order.projects.map((p) => ({ name: p.name })),
        subtotal: (order.subtotal ?? 0) / 100,
        gst: (order.gst ?? 0) / 100,
        total: (order.grandTotal ?? 0) / 100,
        paidAt: order.paidAt,
      },
    };
  });
}

function getMilestoneTemplates(tier: string) {
  if (tier === "STARTER") {
    return [
      { name: "Delivery", pct: 100, deliverables: ["Deployed site", "Source code"] },
    ];
  }
  if (tier === "GROWTH") {
    return [
      { name: "Design & Planning", pct: 30, deliverables: ["Wireframes", "Project plan"] },
      { name: "Development", pct: 40, deliverables: ["Staging deployment", "Core features"] },
      { name: "Review & Delivery", pct: 30, deliverables: ["Final deployment", "Documentation"] },
    ];
  }
  // PREMIUM
  return [
    { name: "Strategy & Discovery", pct: 20, deliverables: ["Strategy document", "Architecture review"] },
    { name: "Design", pct: 20, deliverables: ["Full design system", "Prototype"] },
    { name: "Development Phase 1", pct: 25, deliverables: ["Core features", "Staging"] },
    { name: "Development Phase 2", pct: 20, deliverables: ["All features", "Integration testing"] },
    { name: "QA, Delivery & Handover", pct: 15, deliverables: ["Production deployment", "Full documentation", "Training"] },
  ];
}

function getContractTypes(tier: string): string[] {
  if (tier === "STARTER") return ["MICRO_SOW"];
  if (tier === "GROWTH") return ["SOW", "MSA"];
  return ["SOW", "MSA", "NDA", "IP_WFH", "DPA"];
}

async function getEstimateTotals(estimateId: string) {
  const est = await prisma.estimate.findUnique({ where: { id: estimateId } });
  return est?.totals as any;
}
