import type { FastifyInstance } from "fastify";
import { prisma } from "@stackfox/prisma";
import { requireAuth } from "../plugins/auth";
import { emitEvent } from "../lib/events";
import * as ids from "../lib/id";
import { verifyRazorpaySignature } from "../lib/payments";
import { clientScope } from "../lib/scope";
import { pageParams } from "../lib/http";
import { requireRole } from "../plugins/auth";

// Shapes a raw Prisma invoice into the fields the client dashboard reads
// (total/paidAmount/invoiceNumber/gst/clientDetails), and lowercases status
// to match client/src/lib/utils.js's statusColors keys (e.g. "partially-paid").
// grandTotal/cgst/sgst/igst are stored in paise; formatINR (and the rest of
// the display layer) expects rupees, so the computed display fields below
// convert — the raw paise fields stay untouched via the ...inv spread for
// anything (e.g. Razorpay order creation) that needs paise.
function serializeInvoice(inv: any) {
  const status = String(inv.status ?? "DRAFT").toLowerCase().replace(/_/g, "-");
  const paidAmount = status === "paid" ? inv.grandTotal : 0;
  return {
    ...inv,
    _id: inv.id,
    invoiceNumber: inv.id,
    status,
    total: inv.grandTotal,
    paidAmount,
    gst: {
      isInterState: inv.gstType === "IGST",
      igst: inv.igst,
      cgst: inv.cgst ?? 0,
      sgst: inv.sgst ?? 0,
    },
    clientDetails: { name: inv.org?.name ?? "", email: inv.org?.contactEmail ?? "" },
    project: inv.engagement ? { projectNumber: inv.engagement.id } : null,
  };
}

export async function financeRoutes(app: FastifyInstance) {
  // Invoices
  app.get("/invoices", async (req, reply) => {
    const scope = await clientScope(req, reply);
    if (scope === undefined) return;

    const q = req.query as Record<string, string>;
    const { page, limit, skip } = pageParams(q);
    const where: any = {};

    // Invoices are billed to an Org, so scoping is a direct orgId match.
    if (scope !== null) where.orgId = scope;
    else if (q.orgId) where.orgId = q.orgId;
    if (q.engId) where.engagementId = q.engId;
    if (q.status) where.status = q.status;

    const [items, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: { org: true, engagement: true },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.invoice.count({ where }),
    ]);

    return {
      data: items.map(serializeInvoice),
      meta: { pagination: { total, page, limit, pages: Math.ceil(total / limit) } },
    };
  });

  app.get("/invoices/:id", async (req, reply) => {
    const scope = await clientScope(req, reply);
    if (scope === undefined) return;

    const { id } = req.params as { id: string };
    const invoice = await prisma.invoice.findFirst({
      where: { id, ...(scope !== null ? { orgId: scope } : {}) },
      include: { org: true, engagement: true },
    });
    if (!invoice) return reply.code(404).send({ error: "Invoice not found" });
    return { data: serializeInvoice(invoice) };
  });

  app.post("/invoices", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const body = req.body as any;
    const subtotal = body.subtotal ?? 0;
    const gstRate = 0.18;
    const igst = Math.round(subtotal * gstRate);

    return prisma.invoice.create({
      data: {
        id: ids.invoiceId(),
        engagementId: body.engagementId,
        orgId: body.orgId,
        milestoneRef: body.milestoneRef,
        sacCode: body.sacCode ?? "998314",
        gstType: body.gstType ?? "IGST",
        subtotal,
        igst,
        grandTotal: subtotal + igst,
        status: "DRAFT",
      },
    });
  });

  // Record UTR
  app.patch("/invoices/:id/utr", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { id } = req.params as { id: string };
    const { utr, paidAt } = req.body as { utr: string; paidAt?: string };

    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        utr,
        paidAt: paidAt ? new Date(paidAt) : new Date(),
        status: "PAID",
      },
    });

    await emitEvent({
      code: "INVOICE_PAID",
      payload: { invoiceId: id, utr },
      actor: req.user!.sub,
      engagementId: updated.engagementId ?? undefined,
    });

    return updated;
  });

  // PATCH /invoices/:id/status — admin-only workflow transition.
  app.patch("/invoices/:id/status", async (req, reply) => {
    if (!requireRole(req, reply, ["ADMIN"])) return;
    const { id } = req.params as { id: string };
    const { status } = req.body as { status?: string };

    // Accept the lowercase display form ("partially-paid") or the stored form
    // ("PARTIALLY_PAID") — the admin UI renders the lowercased variant.
    const normalized = String(status ?? "").trim().toUpperCase().replace(/-/g, "_");
    const ALLOWED = ["DRAFT", "SENT", "VIEWED", "PAID", "PARTIALLY_PAID", "OVERDUE", "CANCELLED", "DISPUTED"];
    if (!ALLOWED.includes(normalized)) {
      return reply.code(400).send({ error: `Invalid status. Allowed: ${ALLOWED.join(", ").toLowerCase()}` });
    }

    const existing = await prisma.invoice.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: "Invoice not found" });

    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        status: normalized,
        ...(normalized === "PAID" ? { paidAt: existing.paidAt ?? new Date() } : {}),
      },
    });

    await emitEvent({
      code: "INVOICE_STATUS_CHANGED",
      payload: { invoiceId: id, status: normalized },
      actor: req.user!.sub,
      engagementId: updated.engagementId ?? undefined,
    });

    return { data: serializeInvoice(updated) };
  });


  // Razorpay webhook
  app.post("/webhooks/razorpay", async (req, reply) => {
    const signature = req.headers["x-razorpay-signature"] as string;
    if (!signature) return reply.code(400).send({ error: "Missing signature" });

    const body = JSON.stringify(req.body);
    if (!verifyRazorpaySignature(body, signature)) {
      return reply.code(400).send({ error: "Invalid signature" });
    }

    const payload = req.body as any;
    const eventType = payload.event;
    const entity = payload.payload?.payment?.entity;
    if (!entity) return reply.code(400).send({ error: "Invalid payload" });

    if (eventType === "payment.captured") {
      const rzpOrderId = entity.order_id;

      // Update invoice if linked
      const invoice = await prisma.invoice.findFirst({
        where: { razorpayOrderId: rzpOrderId },
      });
      if (invoice) {
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: { status: "PAID", paidAt: new Date() },
        });
        await emitEvent({
          code: "INVOICE_PAID",
          payload: { invoiceId: invoice.id, gateway: "razorpay" },
          actor: "system",
          engagementId: invoice.engagementId ?? undefined,
        });
      }

      // Update order if linked
      const order = await prisma.order.findFirst({
        where: { razorpayOrderId: rzpOrderId },
      });
      if (order) {
        await prisma.order.update({
          where: { id: order.id },
          data: { status: "PAID", paidAt: new Date() },
        });

        await prisma.payment.create({
          data: {
            orderId: order.id,
            gateway: "RAZORPAY",
            gatewayPaymentId: entity.id,
            gatewayOrderId: rzpOrderId,
            amount: entity.amount,
            currency: entity.currency ?? "INR",
            status: "CAPTURED",
            method: entity.method ?? "unknown",
            metadata: entity,
          },
        });

        await emitEvent({
          code: "PAYMENT_CAPTURED",
          payload: { orderId: order.id, paymentId: entity.id, amount: entity.amount },
          actor: "SYSTEM",
        });
      }
    }

    if (eventType === "payment.failed") {
      await emitEvent({
        code: "PAYMENT_FAILED",
        payload: { orderId: entity.order_id, reason: entity.error_description },
        actor: "SYSTEM",
      });
    }

    return { ok: true };
  });

  // Stripe webhook
  app.post("/webhooks/stripe", async (req, reply) => {
    const event = req.body as any;
    if (event.type === "payment_intent.succeeded") {
      const piId = event.data?.object?.id;
      if (piId) {
        const invoice = await prisma.invoice.findFirst({
          where: { stripePaymentIntentId: piId },
        });
        if (invoice) {
          await prisma.invoice.update({
            where: { id: invoice.id },
            data: { status: "PAID", paidAt: new Date() },
          });
          await emitEvent({
            code: "INVOICE_PAID",
            payload: { invoiceId: invoice.id, gateway: "stripe" },
            actor: "system",
            engagementId: invoice.engagementId ?? undefined,
          });
        }
      }
    }
    return { ok: true };
  });

  // AR Aging
  app.get("/finance/ar-aging", async (req, reply) => {
    if (!requireRole(req, reply, ["ADMIN", "SUPER_ADMIN", "FINANCE", "SENIOR_PM", "PM"])) return;
    const invoices = await prisma.invoice.findMany({
      where: { status: { in: ["SENT", "OVERDUE"] } },
      orderBy: { createdAt: "asc" },
    });

    const now = Date.now();
    const buckets = { current: 0, d30: 0, d60: 0, d90: 0, d90plus: 0 };
    for (const inv of invoices) {
      const days = Math.floor((now - inv.createdAt.getTime()) / 86400000);
      const amt = inv.grandTotal ?? 0;
      if (days <= 0) buckets.current += amt;
      else if (days <= 30) buckets.d30 += amt;
      else if (days <= 60) buckets.d60 += amt;
      else if (days <= 90) buckets.d90 += amt;
      else buckets.d90plus += amt;
    }
    return buckets;
  });

  // WIP summary
  app.get("/finance/wip", async (req, reply) => {
    if (!requireRole(req, reply, ["ADMIN", "SUPER_ADMIN", "FINANCE", "SENIOR_PM", "PM"])) return;
    return prisma.wipLedger.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  });

  // Rev-rec summary
  app.get("/finance/rev-rec", async (req, reply) => {
    if (!requireRole(req, reply, ["ADMIN", "SUPER_ADMIN", "FINANCE", "SENIOR_PM", "PM"])) return;
    return prisma.revrecLedger.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  });

  // GSTR-1 export
  app.get("/finance/gstr1", async (req, reply) => {
    if (!requireRole(req, reply, ["ADMIN", "SUPER_ADMIN", "FINANCE", "SENIOR_PM", "PM"])) return;
    const { month, year } = req.query as { month: string; year: string };
    const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    const endDate = new Date(parseInt(year), parseInt(month), 0);

    const invoices = await prisma.invoice.findMany({
      where: {
        status: "PAID",
        paidAt: { gte: startDate, lte: endDate },
      },
      include: { org: true },
    });

    return invoices.map((inv) => ({
      invoiceId: inv.id,
      gstin: (inv.org as any)?.gstin ?? "",
      sacCode: inv.sacCode,
      subtotal: inv.subtotal,
      igst: inv.igst,
      cgst: inv.cgst,
      sgst: inv.sgst,
      grandTotal: inv.grandTotal,
      paidAt: inv.paidAt,
    }));
  });
}
