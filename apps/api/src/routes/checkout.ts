import type { FastifyInstance } from "fastify";
import { prisma } from "@stackfox/prisma";
import { requireAuth } from "../plugins/auth";
import { emitEvent } from "../lib/events";
import { estimateInputHash } from "../lib/hash";
import { createRazorpayOrder, verifyRazorpaySignature } from "../lib/payments";
import { recordInvoicePayment } from "../lib/billing";
import { queues } from "../lib/queue";
import * as ids from "../lib/id";
import { cache } from "../lib/redis";
import {
  type CheckoutSession,
  createSession,
  readSession,
  writeSession,
  invalidateSession,
} from "../lib/checkoutSession";
import { toJson } from "../lib/json";
import { resolveGstType, splitGst } from "../lib/gst";
import { getContractTypes, getMilestoneTemplates, paymentModeAmount } from "@stackfox/core";
import { parseBody } from "../lib/validate";
import { StartCheckoutSchema, CompleteCheckoutSchema } from "./moneySchemas";

export async function checkoutRoutes(app: FastifyInstance) {
  // POST /checkout/start — hash guard G-039
  app.post("/checkout/start", async (req, reply) => {
    const started = parseBody(req, reply, StartCheckoutSchema);
    if (!started) return;
    const { estimateId } = started;
    const estimate = await prisma.estimate.findUnique({
      where: { id: estimateId },
      include: { workspace: { include: { customLineItems: true } } },
    });
    if (!estimate) return reply.code(404).send({ error: "Estimate not found" });

    if (estimate.status !== "ACTIVE") {
      return reply.code(409).send({ error: "Estimate is no longer active" });
    }
    if (new Date() > estimate.lockedUntil) {
      await prisma.estimate.update({ where: { id: estimateId }, data: { status: "EXPIRED" } });
      await emitEvent({ code: "ESTIMATE_EXPIRED", payload: { estimateId }, actor: "SYSTEM" });
      return reply.code(410).send({ error: "Estimate has expired. Please regenerate." });
    }

    // G-039: verify nothing the estimate was priced from has drifted.
    const ws = estimate.workspace;
    const currentHash = estimateInputHash({
      canvas: (ws.canvas as any[]) ?? [],
      customLines: ws.customLineItems ?? [],
      timelineMult: ws.timelineMult,
    });
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
      tier: started.tier ?? "GROWTH",
      step: 1,
    };

    await createSession(sid, session, req.user?.sub);

    await emitEvent({
      code: session.tier === "STARTER" ? "EXPRESS_CHECKOUT_STARTED" : "SCOPE_001",
      payload: { sid, estimateId, tier: session.tier },
      actor: req.user?.sub ?? "ANONYMOUS",
    });

    return { sid, session };
  });

  // GET /checkout/:sid/status
  app.get("/checkout/:sid/status", async (req, reply) => {
    const { sid } = req.params as { sid: string };
    const session = await readSession(sid);
    if (!session) return reply.code(404).send({ error: "Session not found or expired" });
    return session;
  });

  // PATCH /checkout/:sid/step2 — account details
  app.patch("/checkout/:sid/step2", async (req, reply) => {
    const { sid } = req.params as { sid: string };
    const session = await readSession(sid);
    if (!session) return reply.code(404).send({ error: "Session expired" });
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

    await writeSession(sid, session);
    return session;
  });

  // PATCH /checkout/:sid/step3 — engagement details
  app.patch("/checkout/:sid/step3", async (req, reply) => {
    const { sid } = req.params as { sid: string };
    const session = await readSession(sid);
    if (!session) return reply.code(404).send({ error: "Session expired" });
    session.engagementDetails = req.body as Record<string, unknown>;
    session.step = 3;
    await writeSession(sid, session);
    return session;
  });

  // PATCH /checkout/:sid/step4 — payment terms
  app.patch("/checkout/:sid/step4", async (req, reply) => {
    const { sid } = req.params as { sid: string };
    const session = await readSession(sid);
    if (!session) return reply.code(404).send({ error: "Session expired" });
    session.paymentTerms = req.body as Record<string, unknown>;
    session.step = 4;
    await writeSession(sid, session);
    return session;
  });

  // PATCH /checkout/:sid/step5 — clause selections
  app.patch("/checkout/:sid/step5", async (req, reply) => {
    const { sid } = req.params as { sid: string };
    const session = await readSession(sid);
    if (!session) return reply.code(404).send({ error: "Session expired" });
    session.clauseSelections = req.body as Record<string, unknown>;
    session.step = 5;
    await writeSession(sid, session);

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

    const session = await readSession(sid);
    if (!session) return reply.code(404).send({ error: "Session expired" });
    session.signed = true;
    session.step = 6;
    await writeSession(sid, session);

    return { signed: true, rail };
  });

  // POST /checkout/:sid/pay — create Razorpay order
  app.post("/checkout/:sid/pay", async (req, reply) => {
    const { sid } = req.params as { sid: string };
    const session = await readSession(sid);
    if (!session) return reply.code(404).send({ error: "Session expired" });
    const totals = await getEstimateTotals(session.estimateId);
    if (!totals) return reply.code(500).send({ error: "Cannot read estimate totals" });

    const paymentMode = (session.paymentTerms as any)?.mode ?? "MILESTONE";
    const amount = paymentModeAmount(totals.grand, paymentMode);

    const order = await createRazorpayOrder(amount, "INR", `ckout_${sid}`);
    session.razorpayOrderId = order.id;
    await writeSession(sid, session);

    return {
      razorpayOrderId: order.id,
      amount,
      currency: "INR",
      keyId: process.env.RAZORPAY_KEY_ID,
    };
  });

  // POST /checkout/:sid/complete — create order + engagement + projects + contracts
  //
  // Everything this handler writes is one commercial commitment, so it is one
  // transaction. It used to be eight-plus independent statements with the
  // session key deleted only at the very end, which gave two distinct failures:
  //
  //   Partial commit — a connection blip after the engagement insert left an
  //   ACTIVE engagement with no contract and no invoice. The customer was
  //   committed and unbilled, and nothing reconciled it.
  //
  //   Duplicate commit — a double-click or a client retry re-ran the whole
  //   sequence because the session was still present, producing two
  //   engagements, two orders, two project sets and two invoices for one
  //   purchase, with the duplicate invoice marked PAID if the Razorpay
  //   handshake was attached.
  //
  // Side effects (events, queued jobs) are emitted AFTER commit on purpose: a
  // rolled-back transaction that had already enqueued a job would leave a
  // worker acting on rows that do not exist.
  app.post("/checkout/:sid/complete", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { sid } = req.params as { sid: string };
    const payload = parseBody(req, reply, CompleteCheckoutSchema);
    if (!payload) return;
    const lockKey = `checkout-complete:${sid}`;

    // Guards concurrent submits. The consumedAt check below guards sequential
    // ones, and is durable where this lock is not.
    if (!(await cache.lock(lockKey, 60_000))) {
      return reply.code(409).send({
        error: "This checkout is already being completed. Please wait a moment.",
      });
    }

    try {
      const session = await readSession(sid);
      if (!session) return reply.code(404).send({ error: "Session expired" });

      // Already provisioned — return what was created rather than doing it
      // again, so a retry is indistinguishable from the original success.
      if (session.consumedAt && session.resultOrderId) {
        const previous = await loadCompletedCheckout(session.resultOrderId);
        if (previous) return previous;
      }

      const estimate = await prisma.estimate.findUnique({ where: { id: session.estimateId } });
      if (!estimate) return reply.code(404).send({ error: "Estimate not found" });

      const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
      if (!user?.orgId) return reply.code(400).send({ error: "Organization required" });
      const orgId = user.orgId;

      const engId = ids.engagementId();
      const ordId = ids.orderId();
      const snapshot = estimate.snapshot as any;
      const totals = estimate.totals as any;
      const canvas = (snapshot?.canvas as any[]) ?? [];

      // One query for every service in the cart instead of one per item.
      const services = await prisma.serviceUnit.findMany({
        where: { id: { in: canvas.map((c: any) => c.serviceId).filter(Boolean) } },
      });
      const serviceById = new Map(services.map((svc) => [svc.id, svc]));

      const invoiceAmount = paymentModeAmount(
        totals.grand,
        (session.paymentTerms as any)?.mode ?? "MILESTONE",
      );
      const billTo = await prisma.org.findUnique({ where: { id: orgId } });
      const gstType = resolveGstType(billTo);
      const subtotal = Math.round(invoiceAmount / 1.18);
      const { cgst, sgst, igst } = splitGst(invoiceAmount - subtotal, gstType);

      // Verify the handshake BEFORE writing anything — a bad signature must not
      // leave a provisioned engagement behind.
      const pay = payload;
      const hasHandshake = Boolean(pay.razorpay_payment_id && pay.razorpay_signature);
      const rzpOrderId = pay.razorpay_order_id ?? session.razorpayOrderId;
      if (hasHandshake) {
        const valid =
          !!rzpOrderId &&
          verifyRazorpaySignature(rzpOrderId, pay.razorpay_payment_id!, pay.razorpay_signature);
        if (!valid) {
          return reply.code(400).send({ error: "Payment signature verification failed" });
        }
      }

      const result = await prisma.$transaction(
        async (tx) => {
          const engagement = await tx.engagement.create({
            data: {
              id: engId,
              clientId: orgId,
              model: (session.engagementDetails as any)?.model ?? "FPM",
              commercial: totals,
              status: "ACTIVE",
              executedAt: new Date(),
            },
          });

          const order = await tx.order.create({
            data: {
              id: ordId,
              orgId,
              estimateId: estimate.id,
              engagementId: engId,
              projectName: (session.engagementDetails as any)?.projectName ?? "New Project",
              primaryContact: { name: user.name, email: user.email, phone: user.phone },
              paymentMode: (session.paymentTerms as any)?.mode ?? "MILESTONE",
              clauseConfig: toJson(session.clauseSelections ?? {}),
              tier: session.tier,
              referralCode: payload.referralCode,
              status: "ACCEPTED",
            },
          });

          const milestoneTemplates = getMilestoneTemplates(session.tier);
          const projects = [];
          for (const item of canvas) {
            const service = serviceById.get(item.serviceId);
            if (!service) continue;

            const prefix = service.id.split("-").slice(0, 2).join("-");
            const project = await tx.project.create({
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

            // One insert for the whole milestone set rather than one each.
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
          for (const type of getContractTypes(session.tier)) {
            contracts.push(
              await tx.contract.create({
                data: {
                  orderId: ordId,
                  engagementId: engId,
                  type,
                  clauseConfig: toJson(session.clauseSelections ?? {}),
                  status: session.signed ? "CLIENT_SIGNED" : "DRAFT",
                },
              }),
            );
          }

          await tx.estimate.update({
            where: { id: estimate.id },
            data: { status: "CONVERTED" },
          });

          const invoice = await tx.invoice.create({
            data: {
              id: ids.invoiceId(),
              orderId: ordId,
              engagementId: engId,
              orgId,
              milestoneRef: "M1",
              sacCode: "998314",
              gstType,
              subtotal,
              cgst,
              sgst,
              igst,
              grandTotal: invoiceAmount,
              status: hasHandshake ? "PAID" : "SENT",
              ...(hasHandshake
                ? {
                    paidAt: new Date(),
                    utr: pay.razorpay_payment_id,
                    amountPaid: invoiceAmount,
                  }
                : {}),
              dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
          });

          // Consumed in the SAME transaction that provisions. If anything above
          // rolls back this does too, so a retry re-runs cleanly; if it commits,
          // a retry short-circuits at the top of the handler.
          await tx.checkoutSession.update({
            where: { id: sid },
            data: { consumedAt: new Date(), resultOrderId: ordId },
          });

          return { order, engagement, projects, contracts, invoice };
        },
        { timeout: 30_000, maxWait: 10_000 },
      );

      // ── Committed. Side effects from here on. ─────────────────────────────
      await invalidateSession(sid);

      if (hasHandshake) {
        await recordInvoicePayment(result.invoice, {
          gateway: "RAZORPAY",
          gatewayPaymentId: pay.razorpay_payment_id!,
          gatewayOrderId: rzpOrderId,
        });
        await emitEvent({
          code: "INVOICE_PAID",
          payload: {
            invoiceId: result.invoice.id,
            gateway: "razorpay",
            razorpayPaymentId: pay.razorpay_payment_id,
          },
          actor: req.user!.sub,
          engagementId: engId,
        });
      }

      for (const c of result.contracts) {
        await queues.docGen
          .add("contract-pdf", { type: "contract", contractId: c.id, contractType: c.type })
          .catch(() => {});
      }
      await queues.docGen
        .add("invoice-pdf", { type: "invoice", invoiceId: result.invoice.id })
        .catch(() => {});

      await emitEvent({ code: "ESTIMATE_CONVERTED", payload: { estimateId: estimate.id }, actor: req.user!.sub });
      await emitEvent({ code: "ORDER_PLACED", payload: { orderId: ordId, tier: session.tier }, actor: req.user!.sub });
      await emitEvent({ code: "ENGAGEMENT_CREATED", payload: { engagementId: engId }, actor: req.user!.sub, engagementId: engId });
      await emitEvent({ code: "INVOICE_CREATED", payload: { invoiceId: result.invoice.id }, actor: "SYSTEM" });
      for (const p of result.projects) {
        await emitEvent({ code: "PROJECT_CREATED", payload: { projectId: p.id }, actor: req.user!.sub, projectId: p.id, engagementId: engId });
      }

      if (payload.referralCode) {
        await queues.referralProcessor
          .add("convert", { referralCode: payload.referralCode, orderId: ordId })
          .catch(() => {});
      }

      const { contracts: _contracts, ...response } = result;
      return response;
    } finally {
      await cache.unlock(lockKey);
    }
  });


  // POST /checkout/express — Starter tier 3-field checkout
  app.post("/checkout/express", async (req, reply) => {
    const { name, phone, email, packageId, addOns } = req.body as {
      name: string;
      phone: string;
      email: string;
      packageId: string;
      addOns?: string[];
    };

    const pkg = await prisma.package.findUnique({
      where: { id: packageId },
      include: { service: true },
    });
    if (!pkg) return reply.code(404).send({ error: "Package not found" });

    // Calculate total with add-ons
    const total = pkg.flatPrice;
    // Add-on pricing would be looked up from a config table

    // Create or find user
    let user = await prisma.user.findFirst({
      where: { OR: [{ email }, { phone }] },
    });
    if (!user) {
      user = await prisma.user.create({
        data: { name, email, phone, role: "INDIVIDUAL_CLIENT" },
      });
    }

    // Create Razorpay order
    const rzpOrder = await createRazorpayOrder(total, "INR", `express_${packageId}`);

    await emitEvent({
      code: "EXPRESS_CHECKOUT_STARTED",
      payload: { packageId, userId: user.id, total },
      actor: user.id,
    });

    return {
      razorpayOrderId: rzpOrder.id,
      amount: total,
      currency: "INR",
      keyId: process.env.RAZORPAY_KEY_ID,
      userId: user.id,
    };
  });
}

/**
 * Rebuilds the /complete response for a checkout that already ran, so a retry
 * returns the original result rather than a 404 or a second provisioning.
 */
async function loadCompletedCheckout(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order?.engagementId) return null;

  const [engagement, projects, invoice] = await Promise.all([
    prisma.engagement.findUnique({ where: { id: order.engagementId } }),
    prisma.project.findMany({ where: { orderId } }),
    prisma.invoice.findFirst({ where: { orderId }, orderBy: { createdAt: "asc" } }),
  ]);
  if (!engagement || !invoice) return null;
  return { order, engagement, projects, invoice };
}



async function getEstimateTotals(estimateId: string) {
  const est = await prisma.estimate.findUnique({ where: { id: estimateId } });
  return est?.totals as any;
}
