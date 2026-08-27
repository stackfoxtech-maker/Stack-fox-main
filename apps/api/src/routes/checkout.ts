import type { FastifyInstance } from "fastify";
import { prisma } from "@stackfox/prisma";
import { requireAuth } from "../plugins/auth";
import { emitEvent } from "../lib/events";
import { canonicalHash } from "../lib/hash";
import { createRazorpayOrder } from "../lib/payments";
import { queues } from "../lib/queue";
import * as ids from "../lib/id";
import { redis } from "../lib/redis";
import { toJson } from "../lib/json";

interface CheckoutSession {
  estimateId: string;
  tier: string;
  step: number;
  accountDetails?: Record<string, unknown>;
  engagementDetails?: Record<string, unknown>;
  paymentTerms?: Record<string, unknown>;
  clauseSelections?: Record<string, unknown>;
  signed?: boolean;
  razorpayOrderId?: string;
}

export async function checkoutRoutes(app: FastifyInstance) {
  // POST /checkout/start — hash guard G-039
  app.post("/checkout/start", async (req, reply) => {
    const { estimateId } = req.body as { estimateId: string };
    const estimate = await prisma.estimate.findUnique({
      where: { id: estimateId },
      include: { workspace: true },
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
    const { sid } = req.params as { sid: string };
    const data = await redis.get(`checkout:${sid}`);
    if (!data) return reply.code(404).send({ error: "Session not found or expired" });
    return JSON.parse(data);
  });

  // PATCH /checkout/:sid/step2 — account details
  app.patch("/checkout/:sid/step2", async (req, reply) => {
    const { sid } = req.params as { sid: string };
    const raw = await redis.get(`checkout:${sid}`);
    if (!raw) return reply.code(404).send({ error: "Session expired" });

    const session: CheckoutSession = JSON.parse(raw);
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
    const { sid } = req.params as { sid: string };
    const raw = await redis.get(`checkout:${sid}`);
    if (!raw) return reply.code(404).send({ error: "Session expired" });

    const session: CheckoutSession = JSON.parse(raw);
    session.engagementDetails = req.body as Record<string, unknown>;
    session.step = 3;
    await redis.set(`checkout:${sid}`, JSON.stringify(session), "EX", 3600);
    return session;
  });

  // PATCH /checkout/:sid/step4 — payment terms
  app.patch("/checkout/:sid/step4", async (req, reply) => {
    const { sid } = req.params as { sid: string };
    const raw = await redis.get(`checkout:${sid}`);
    if (!raw) return reply.code(404).send({ error: "Session expired" });

    const session: CheckoutSession = JSON.parse(raw);
    session.paymentTerms = req.body as Record<string, unknown>;
    session.step = 4;
    await redis.set(`checkout:${sid}`, JSON.stringify(session), "EX", 3600);
    return session;
  });

  // PATCH /checkout/:sid/step5 — clause selections
  app.patch("/checkout/:sid/step5", async (req, reply) => {
    const { sid } = req.params as { sid: string };
    const raw = await redis.get(`checkout:${sid}`);
    if (!raw) return reply.code(404).send({ error: "Session expired" });

    const session: CheckoutSession = JSON.parse(raw);
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

    const raw = await redis.get(`checkout:${sid}`);
    if (!raw) return reply.code(404).send({ error: "Session expired" });

    const session: CheckoutSession = JSON.parse(raw);
    session.signed = true;
    session.step = 6;
    await redis.set(`checkout:${sid}`, JSON.stringify(session), "EX", 3600);

    return { signed: true, rail };
  });

  // POST /checkout/:sid/pay — create Razorpay order
  app.post("/checkout/:sid/pay", async (req, reply) => {
    const { sid } = req.params as { sid: string };
    const raw = await redis.get(`checkout:${sid}`);
    if (!raw) return reply.code(404).send({ error: "Session expired" });

    const session: CheckoutSession = JSON.parse(raw);
    const totals = await getEstimateTotals(session.estimateId);
    if (!totals) return reply.code(500).send({ error: "Cannot read estimate totals" });

    const paymentMode = (session.paymentTerms as any)?.mode ?? "MILESTONE";
    let amount = totals.grand;

    if (paymentMode === "UPFRONT") {
      amount = Math.round(totals.grand * 0.95); // 5% discount
    } else if (paymentMode === "MILESTONE") {
      // First milestone payment (typically 30%)
      amount = Math.round(totals.grand * 0.3);
    }

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
    const raw = await redis.get(`checkout:${sid}`);
    if (!raw) return reply.code(404).send({ error: "Session expired" });

    const session: CheckoutSession = JSON.parse(raw);
    const estimate = await prisma.estimate.findUnique({ where: { id: session.estimateId } });
    if (!estimate) return reply.code(404).send({ error: "Estimate not found" });

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

    // Mark estimate as converted
    await prisma.estimate.update({
      where: { id: estimate.id },
      data: { status: "CONVERTED" },
    });

    // Generate first invoice
    const invoiceAmount = (session.paymentTerms as any)?.mode === "UPFRONT"
      ? Math.round(totals.grand * 0.95)
      : Math.round(totals.grand * 0.3);

    const gstType = determineGstType(user.orgId);
    const gstRate = 0.18;
    const subtotal = Math.round(invoiceAmount / (1 + gstRate));
    const gstAmount = invoiceAmount - subtotal;

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
        cgst: gstType === "CGST_SGST" ? Math.round(gstAmount / 2) : 0,
        sgst: gstType === "CGST_SGST" ? Math.round(gstAmount / 2) : 0,
        igst: gstType === "IGST" ? gstAmount : 0,
        grandTotal: invoiceAmount,
        status: "SENT",
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

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
    let total = pkg.flatPrice;
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

function determineGstType(_orgId: string): string {
  // TODO: check org billing state vs StackFox state (Rajasthan)
  return "IGST";
}

async function getEstimateTotals(estimateId: string) {
  const est = await prisma.estimate.findUnique({ where: { id: estimateId } });
  return est?.totals as any;
}
