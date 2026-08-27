import type { FastifyInstance } from "fastify";
import { prisma } from "@stackfox/prisma";
import { requireAuth } from "../plugins/auth";
import { generateContent, generateStructured } from "../lib/gemini";
import { queues } from "../lib/queue";
import * as ids from "../lib/id";
import { emitEvent } from "../lib/events";
import { toJson } from "../lib/json";

/** Tier pricing spread applied on top of the point rate card. */
const TIER_MULTIPLIER: Record<string, number> = {
  STARTER: 0.8,
  GROWTH: 1,
  PREMIUM: 1.4,
};

export async function toolRoutes(app: FastifyInstance) {
  // Website Audit Tool
  app.post(
    "/tools/audit",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (req) => {
    const { url, email } = req.body as { url: string; email?: string };
    const session = await prisma.toolSession.create({
      data: { tool: "AUDIT", input: { url, email }, status: "PROCESSING" },
    });

    const prompt = `Analyze the website at ${url}. Provide a comprehensive audit covering:
1. Performance (load time, core web vitals estimates)
2. SEO (meta tags, headings, structured data)
3. Accessibility (WCAG compliance issues)
4. Security (HTTPS, headers)
5. Mobile responsiveness
6. Recommendations for IT services that could improve the site.
Return as JSON with sections: performance, seo, accessibility, security, mobile, recommendations.`;

    const result = await generateContent(prompt);
    await prisma.toolSession.update({
      where: { id: session.id },
      data: { output: { report: result }, status: "COMPLETED" },
    });

    if (email) {
      await prisma.toolConversion.create({
        data: { sessionId: session.id, email, source: "audit" },
      });
    }

    return { sessionId: session.id, report: result };
  });

  // Instant Estimate Tool
  app.post(
    "/tools/estimate",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (req) => {
    const { services, tier, email } = req.body as { services: string[]; tier?: string; email?: string };
    const session = await prisma.toolSession.create({
      data: { tool: "ESTIMATE", input: { services, tier }, status: "PROCESSING" },
    });

    const serviceUnits = await prisma.serviceUnit.findMany({
      where: { OR: [{ id: { in: services } }, { slug: { in: services } }] },
      include: { featureUnits: true },
    });

    // Rate cards are effective-dated rather than flagged active: the live rate
    // is the most recent one whose effectiveFrom has already passed.
    const rateCard = await prisma.rateCard.findFirst({
      where: { type: "POINT", effectiveFrom: { lte: new Date() } },
      orderBy: { effectiveFrom: "desc" },
    });

    const rate = rateCard?.rate ?? 500000; // paise per point
    const tierMultiplier = TIER_MULTIPLIER[tier ?? "GROWTH"] ?? 1;

    const items = serviceUnits.map((su) => {
      const points = su.baseWeight;
      const cost = Math.round(points * rate * tierMultiplier);
      return { service: su.name, code: su.id, slug: su.slug, points, cost };
    });

    const subtotal = items.reduce((s, i) => s + i.cost, 0);
    const gst = Math.round(subtotal * 0.18);
    const estimate = { items, subtotal, gst, total: subtotal + gst, tier: tier ?? "GROWTH" };

    await prisma.toolSession.update({
      where: { id: session.id },
      data: { output: estimate, status: "COMPLETED" },
    });

    if (email) {
      await prisma.toolConversion.create({
        data: { sessionId: session.id, email, source: "estimate" },
      });
    }

    return { sessionId: session.id, estimate };
  });

  // Brief Generator Tool
  app.post(
    "/tools/brief",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (req) => {
    const { industry, goals, budget, timeline } = req.body as any;
    const session = await prisma.toolSession.create({
      data: { tool: "BRIEF", input: { industry, goals, budget, timeline }, status: "PROCESSING" },
    });

    const prompt = `Generate a professional IT services project brief for:
Industry: ${industry}
Goals: ${JSON.stringify(goals)}
Budget range: ${budget}
Timeline: ${timeline}
Include: executive summary, scope, deliverables, timeline, budget breakdown, success metrics.
Return as structured JSON.`;

    const result = await generateContent(prompt);
    await prisma.toolSession.update({
      where: { id: session.id },
      data: { output: { brief: result }, status: "COMPLETED" },
    });

    return { sessionId: session.id, brief: result };
  });

  // Legal Template Generator
  app.post(
    "/tools/legal",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (req) => {
    const { templateType, params } = req.body as { templateType: string; params: any };
    const session = await prisma.toolSession.create({
      data: { tool: "LEGAL", input: { templateType, params }, status: "PROCESSING" },
    });

    const prompt = `Generate a ${templateType} legal document template for IT services with these parameters: ${JSON.stringify(params)}. Include standard clauses for Indian IT services. Return as structured JSON with sections.`;

    const result = await generateContent(prompt);
    await prisma.toolSession.update({
      where: { id: session.id },
      data: { output: { document: result }, status: "COMPLETED" },
    });

    return { sessionId: session.id, document: result };
  });

  // Invoice Generator Tool
  app.post(
    "/tools/invoice",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (req) => {
    const body = req.body as any;
    const session = await prisma.toolSession.create({
      data: { tool: "INVOICE", input: body, status: "PROCESSING" },
    });

    const subtotal = body.lineItems?.reduce((s: number, l: any) => s + (l.amount ?? 0), 0) ?? 0;
    const gstRate = 0.18;
    const gst = Math.round(subtotal * gstRate);

    const invoice = {
      from: body.from,
      to: body.to,
      lineItems: body.lineItems,
      subtotal,
      gst,
      total: subtotal + gst,
      sacCode: "998314",
      generatedAt: new Date().toISOString(),
    };

    const toolInvoice = await prisma.toolInvoice.create({
      data: {
        sessionId: session.id,
        data: invoice,
      },
    });

    await prisma.toolSession.update({
      where: { id: session.id },
      data: { output: invoice, status: "COMPLETED" },
    });

    return { sessionId: session.id, invoiceId: toolInvoice.id, invoice };
  });

  // Express Checkout (Starter tier 3-field)
  app.post("/tools/express-checkout", async (req, reply) => {
    const { serviceCode, email, phone } = req.body as { serviceCode: string; email: string; phone: string };

    const service = await prisma.serviceUnit.findFirst({
      where: { OR: [{ id: serviceCode }, { slug: serviceCode }] },
    });
    if (!service) return reply.code(404).send({ error: "Service not found" });

    const expressSubtotal = service.starterPrice ?? 0;

    let org = await prisma.org.findFirst({ where: { contactEmail: email } });
    if (!org) {
      org = await prisma.org.create({
        data: {
          id: ids.orgId(),
          name: email.split("@")[0],
          contactEmail: email,
          contactPhone: phone,
          tier: "STARTER",
          status: "ACTIVE",
        },
      });
    }

    const order = await prisma.order.create({
      data: {
        id: ids.orderId(),
        orgId: org.id,
        tier: "STARTER",
        services: [service.id],
        subtotal: expressSubtotal,
        gst: Math.round(expressSubtotal * 0.18),
        grandTotal: expressSubtotal + Math.round(expressSubtotal * 0.18),
        status: "PENDING_PAYMENT",
      },
    });

    await emitEvent({
      code: "ORDER_PLACED",
      payload: { orderId: order.id, express: true },
      actor: "system",
    });

    return { orderId: order.id, amount: order.grandTotal };
  });

  // Referral
  app.post("/tools/referral", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { referredEmail, referredName } = req.body as { referredEmail: string; referredName: string };

    const referral = await prisma.referral.create({
      data: {
        referrerType: "CLIENT",
        referrerId: req.user!.sub,
        code: ids.referralCode(),
        referredEmail,
        referredName,
        status: "PENDING",
      },
    });

    await queues.referralProcessor.add("process", { referralId: referral.id });
    return referral;
  });

  app.get("/tools/referrals", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    return prisma.referral.findMany({
      where: { referrerId: req.user!.sub },
      orderBy: { createdAt: "desc" },
    });
  });

  // Preview Generator
  app.post(
    "/tools/preview",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (req) => {
    const { serviceId, tier } = req.body as { serviceId: string; tier?: string };
    const service = await prisma.serviceUnit.findUnique({
      where: { id: serviceId },
      include: { featureUnits: true },
    });
    if (!service) return { error: "Service not found" };

    const prompt = `Generate a preview/mockup description for the IT service "${service.name}" at ${tier ?? "GROWTH"} tier. Include: what the deliverable looks like, sample screenshots description, key features highlighted, timeline preview. Return as JSON.`;

    const result = await generateContent(prompt);
    const preview = await prisma.preview.create({
      data: {
        serviceId,
        inputData: toJson({ tier: tier ?? "GROWTH", content: result }),
        status: "GENERATED",
      },
    });

    return { previewId: preview.id, preview: result };
  });

  // WhatsApp webhook
  app.post("/webhooks/whatsapp", async (req) => {
    const payload = req.body as any;
    await queues.whatsappCommerce.add("incoming", payload);
    return { ok: true };
  });

  // Showcase
  app.get("/tools/showcase", async (req) => {
    const { category, tier } = req.query as { category?: string; tier?: string };
    const where: any = { published: true };
    if (category) where.category = category;
    if (tier) where.tier = tier;
    return prisma.showcaseItem.findMany({ where, orderBy: { createdAt: "desc" } });
  });

  // Glossary
  app.get("/tools/glossary", async (req) => {
    const { q } = req.query as { q?: string };
    if (q) {
      return prisma.glossary.findMany({
        where: { term: { contains: q, mode: "insensitive" } },
        orderBy: { term: "asc" },
      });
    }
    return prisma.glossary.findMany({ orderBy: { term: "asc" } });
  });

  // Blueprints
  app.get("/tools/blueprints", async (req) => {
    const { industry } = req.query as { industry?: string };
    const where: any = {};
    if (industry) where.industry = industry;
    return prisma.blueprint.findMany({ where, orderBy: { createdAt: "desc" } });
  });

  app.get("/tools/blueprints/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const bp = await prisma.blueprint.findUnique({ where: { id } });
    if (!bp) return reply.code(404).send({ error: "Blueprint not found" });
    return bp;
  });

  // Demo / Lead capture
  app.post("/lead/demo", async (req) => {
    const { name, email, phone, company, message, preferredDate, source } =
      req.body as {
        name: string;
        email: string;
        phone?: string;
        company?: string;
        message?: string;
        preferredDate?: string;
        source?: string;
      };

    const lead = await prisma.lead.create({
      data: {
        name,
        email,
        phone: phone ?? null,
        company: company ?? null,
        message: message ?? null,
        preferredDate: preferredDate ? new Date(preferredDate) : null,
        source: source ?? "demo_page",
        status: "NEW",
      },
    });

    await emitEvent({
      code: "LEAD_CREATED",
      payload: { leadId: lead.id, source: lead.source },
      actor: "SYSTEM",
    });

    return { success: true, leadId: lead.id };
  });
}
