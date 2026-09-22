import type { FastifyInstance } from "fastify";
import { prisma } from "@stackfox/prisma";
import { requireAuth } from "../plugins/auth";
import { generateContent } from "../lib/gemini";
import { queues } from "../lib/queue";
import * as ids from "../lib/id";
import { emitEvent } from "../lib/events";
import { toJson } from "../lib/json";
import { LIST_CAP } from "../lib/http";
import { createHmac, timingSafeEqual } from "node:crypto";
import { parseBody } from "../lib/validate";
import {
  AuditToolSchema,
  BriefToolSchema,
  CreateReferralSchema,
  EstimateToolSchema,
  ExpressCheckoutSchema,
  LegalTemplateToolSchema,
  WhatsAppWebhookSchema,
  DemoLeadSchema,
  PreviewGenSchema,
} from "./toolSchemas";
import {
  computeInvoice,
  renderGstInvoicePdf,
  type GstInvoiceInput,
} from "../lib/gstInvoice";

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
    async (req, reply) => {
      const body = parseBody(req, reply, AuditToolSchema);
      if (!body) return;
      const { url, email } = body;
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
    },
  );

  // Instant Estimate Tool
  app.post(
    "/tools/estimate",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const body = parseBody(req, reply, EstimateToolSchema);
      if (!body) return;
      const { services, tier, email } = body;
      const session = await prisma.toolSession.create({
        data: { tool: "ESTIMATE", input: { services, tier }, status: "PROCESSING" },
      });

      const serviceUnits = await prisma.serviceUnit.findMany({
        take: LIST_CAP,
        where: { OR: [{ id: { in: services } }, { slug: { in: services } }] },
        include: { featureUnits: true },
      });

      // Rate cards are effective-dated rather than flagged active: the live rate
      // is the most recent one whose effectiveFrom has already passed.
      const rateCard = await prisma.rateCard.findFirst({
        where: { type: "POINT", effectiveFrom: { lte: new Date() } },
        orderBy: { effectiveFrom: "desc" },
      });

      const rate = Number(rateCard?.rate ?? 500000); // paise per point
      const tierMultiplier = TIER_MULTIPLIER[tier ?? "GROWTH"] ?? 1;

      const items = serviceUnits.map((su) => {
        const points = su.baseWeight;
        const cost = Math.round(points * rate * tierMultiplier);
        return { service: su.name, code: su.id, slug: su.slug, points, cost };
      });

      const subtotal = items.reduce((s, i) => s + i.cost, 0);
      const gst = Math.round(subtotal * 0.18);
      const estimate = {
        items,
        subtotal,
        gst,
        total: subtotal + gst,
        tier: tier ?? "GROWTH",
      };

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
    },
  );

  // Brief Generator Tool
  app.post(
    "/tools/brief",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const body = parseBody(req, reply, BriefToolSchema);
      if (!body) return;
      const { industry, goals, budget, timeline } = body;
      const session = await prisma.toolSession.create({
        data: {
          tool: "BRIEF",
          input: { industry, goals, budget, timeline },
          status: "PROCESSING",
        },
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
    },
  );

  // Legal Template Generator
  app.post(
    "/tools/legal",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const body = parseBody(req, reply, LegalTemplateToolSchema);
      if (!body) return;
      const { templateType, params } = body;
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
    },
  );

  // Invoice Generator Tool
  //
  // Full GST invoice engine (see lib/gstInvoice.ts): tax / proforma / credit /
  // debit note, intra vs inter-State and export/SEZ supply, per-line discounts,
  // round-off, SAC-wise tax breakup, amount-in-words, and a single-page A4 PDF
  // returned inline as base64 so the tool works with no storage round-trip.
  app.post(
    "/tools/invoice",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const body = (req.body ?? {}) as GstInvoiceInput;
      const session = await prisma.toolSession.create({
        data: { tool: "INVOICE", input: toJson(body), status: "PROCESSING" },
      });

      let computed;
      try {
        computed = computeInvoice(body);
      } catch (err) {
        await prisma.toolSession.update({
          where: { id: session.id },
          data: { status: "FAILED" },
        });
        return reply
          .code(400)
          .send({ error: "Could not compute invoice from the supplied data." });
      }

      let pdfBase64: string | null = null;
      try {
        const pdf = await renderGstInvoicePdf(computed);
        pdfBase64 = pdf.toString("base64");
      } catch (err) {
        req.log.error(err, "GST invoice PDF render failed");
      }

      const toolInvoice = await prisma.toolInvoice.create({
        data: {
          sessionId: session.id,
          userId: req.user?.sub ?? null,
          invoiceNumber: computed.invoiceNumber,
          data: toJson(computed),
        },
      });

      await prisma.toolSession.update({
        where: { id: session.id },
        data: { output: toJson({ ...computed, pdf: undefined }), status: "COMPLETED" },
      });

      return {
        sessionId: session.id,
        invoiceId: toolInvoice.id,
        invoice: computed,
        pdfBase64,
      };
    },
  );

  // Re-fetch a previously generated tool invoice (and regenerate its PDF).
  app.get("/tools/invoice/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const row = await prisma.toolInvoice.findUnique({ where: { id } });
    if (!row) return reply.code(404).send({ error: "Invoice not found" });

    const data = row.data as Record<string, unknown>;
    let pdfBase64: string | null = null;
    try {
      // `data` is already a ComputedInvoice; recompute the PDF from it.
      pdfBase64 = (await renderGstInvoicePdf(data as any)).toString("base64");
    } catch {
      /* older rows may predate the engine — return JSON only */
    }
    return { invoiceId: row.id, invoice: data, pdfBase64 };
  });

  // Express Checkout (Starter tier 3-field)
  app.post("/tools/express-checkout", async (req, reply) => {
    const body = parseBody(req, reply, ExpressCheckoutSchema);
    if (!body) return;
    const { serviceCode, email, phone } = body;

    const service = await prisma.serviceUnit.findFirst({
      where: { OR: [{ id: serviceCode }, { slug: serviceCode }] },
    });
    if (!service) return reply.code(404).send({ error: "Service not found" });

    const expressSubtotal = Number(service.starterPrice ?? 0);

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
    const body = parseBody(req, reply, CreateReferralSchema);
    if (!body) return;
    const { referredEmail, referredName } = body;

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
    async (req, reply) => {
      const body = parseBody(req, reply, PreviewGenSchema);
      if (!body) return;
      const { serviceId, tier } = body;
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
    },
  );

  // ── WhatsApp webhook ──────────────────────────────────────────────────────
  //
  // This had no authentication of any kind. Anything posted here was enqueued,
  // and the worker then (1) sent the text to Gemini, (2) wrote a row, and
  // (3) posted a reply *to the `from` number in the request* through the
  // business WhatsApp account. So an anonymous caller chose both the recipient
  // and, through the model, much of the message — using StackFox's own
  // verified number, and StackFox's money, to message arbitrary people.
  //
  // WHATSAPP_WEBHOOK_VERIFY_TOKEN is documented in .env.example and was read
  // nowhere. It is the app secret Meta signs the body with, so it is what this
  // verifies.
  app.post("/webhooks/whatsapp", async (req, reply) => {
    const secret = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
    if (!secret) {
      // Fail closed. The outbound half of this integration is unconfigured
      // anyway (the code reads WHATSAPP_BSP_URL, which nothing sets), so
      // refusing costs nothing today and stops the queue being a free door.
      req.log.warn(
        "WhatsApp webhook received but WHATSAPP_WEBHOOK_VERIFY_TOKEN is unset",
      );
      return reply.code(503).send({ error: "WhatsApp is not configured on this server" });
    }

    const rawBody = (req as { rawBody?: string }).rawBody;
    const signature = req.headers["x-hub-signature-256"];
    if (!rawBody || typeof signature !== "string") {
      return reply.code(401).send({ error: "Unsigned request" });
    }

    // Meta sends "sha256=<hex>". Compared in constant time.
    const expected =
      "sha256=" + createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
    const a = Buffer.from(signature, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      req.log.warn("WhatsApp webhook signature mismatch");
      return reply.code(401).send({ error: "Invalid signature" });
    }

    const payload = parseBody(req, reply, WhatsAppWebhookSchema);
    if (!payload) return;

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
  app.post("/lead/demo", async (req, reply) => {
    const body = parseBody(req, reply, DemoLeadSchema);
    if (!body) return;
    const { name, email, phone, company, message, preferredDate, source } = body;

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
