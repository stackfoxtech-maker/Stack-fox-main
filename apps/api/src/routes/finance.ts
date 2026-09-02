import type { FastifyInstance } from "fastify";
import { prisma } from "@stackfox/prisma";
import { emitEvent } from "../lib/events";
import * as ids from "../lib/id";
import { verifyRazorpaySignature, getStripe } from "../lib/payments";
import { recordInvoicePayment } from "../lib/billing";
import { clientScope } from "../lib/scope";
import { pageParams } from "../lib/http";
import { requireRole } from "../plugins/auth";

const VALID_GST_RATES = [0, 5, 12, 18, 28];
const INVOICE_STATUSES = [
  "DRAFT", "SENT", "VIEWED", "PAID", "PARTIALLY_PAID", "OVERDUE", "CANCELLED", "DISPUTED",
];
/** Statuses that represent a live receivable (issued, not settled or void). */
const OPEN_RECEIVABLE = ["SENT", "VIEWED", "OVERDUE", "PARTIALLY_PAID", "DISPUTED"];

// Shapes a raw Prisma invoice into the fields the client dashboard reads
// (total/paidAmount/invoiceNumber/gst/clientDetails), and lowercases status
// to match client/src/lib/utils.js's statusColors keys (e.g. "partially-paid").
// grandTotal/cgst/sgst/igst/amountPaid are stored in paise; formatINR (and the
// rest of the display layer) expects rupees, so the computed display fields
// below convert — the raw paise fields stay untouched via the ...inv spread for
// anything (e.g. Razorpay order creation) that needs paise.
function serializeInvoice(inv: any) {
  const rawStatus = String(inv.status ?? "DRAFT").toUpperCase();
  const status = rawStatus.toLowerCase().replace(/_/g, "-");
  const grandTotal = inv.grandTotal ?? 0;
  // A PAID invoice has collected its full total even if `amountPaid` was never
  // backfilled on an older row; otherwise trust the tracked figure.
  const paidAmount =
    rawStatus === "PAID"
      ? grandTotal
      : Math.min(Math.max(0, inv.amountPaid ?? 0), grandTotal);
  return {
    ...inv,
    _id: inv.id,
    invoiceNumber: inv.id,
    status,
    total: grandTotal,
    paidAmount,
    balanceDue: Math.max(0, grandTotal - paidAmount),
    gst: {
      isInterState: inv.gstType === "IGST",
      rate: inv.gstRate ?? 18,
      igst: inv.igst,
      cgst: inv.cgst ?? 0,
      sgst: inv.sgst ?? 0,
    },
    clientDetails: {
      name: inv.org?.name ?? "",
      email: inv.org?.contactEmail ?? "",
      gstin: inv.org?.gstin ?? "",
    },
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

  // Create an invoice.
  //
  // Internal-only. The tax split is driven by `gstType` (CGST_SGST intra-State
  // vs IGST inter-State) and a validated `gstRate`, not a hardcoded 18% IGST —
  // an intra-State invoice created here used to book all its tax as IGST.
  app.post("/invoices", async (req, reply) => {
    if (!requireRole(req, reply, ["ADMIN", "SUPER_ADMIN", "FINANCE"])) return;
    const body = (req.body ?? {}) as Record<string, any>;

    if (!body.orgId) return reply.code(400).send({ error: "orgId is required" });

    const subtotal = Math.max(0, Math.round(Number(body.subtotal) || 0));
    const gstRate = VALID_GST_RATES.includes(Number(body.gstRate)) ? Number(body.gstRate) : 18;
    const gstType = body.gstType === "CGST_SGST" ? "CGST_SGST" : "IGST";

    const taxTotal = Math.round((subtotal * gstRate) / 100);
    const cgst = gstType === "CGST_SGST" ? Math.round(taxTotal / 2) : 0;
    const sgst = gstType === "CGST_SGST" ? taxTotal - cgst : 0;
    const igst = gstType === "IGST" ? taxTotal : 0;
    const grandTotal = subtotal + cgst + sgst + igst;

    // ids.invoiceId() is a random 4-digit suffix within the month — on the rare
    // primary-key collision, retry rather than surfacing a raw P2002.
    for (let attempt = 0; ; attempt++) {
      try {
        const invoice = await prisma.invoice.create({
          data: {
            id: ids.invoiceId(),
            engagementId: body.engagementId ?? null,
            orderId: body.orderId ?? null,
            orgId: body.orgId,
            milestoneRef: body.milestoneRef ?? null,
            sacCode: body.sacCode ?? "998314",
            gstType,
            gstRate,
            subtotal,
            cgst,
            sgst,
            igst,
            grandTotal,
            status: "DRAFT",
            dueDate: body.dueDate ? new Date(body.dueDate) : null,
          },
        });

        await emitEvent({
          code: "INVOICE_CREATED",
          payload: { invoiceId: invoice.id, grandTotal },
          actor: req.user!.sub,
          engagementId: invoice.engagementId ?? undefined,
        });

        return reply.code(201).send({ data: serializeInvoice(invoice) });
      } catch (err: any) {
        if (err?.code === "P2002" && attempt < 4) continue;
        throw err;
      }
    }
  });

  // Record a bank transfer (UTR) against an invoice.
  //
  // Finance-only — this settles money, so it must not be reachable with a bare
  // client token. Supports partial settlement via `amount` (paise); without it
  // the remaining balance is assumed paid.
  app.patch("/invoices/:id/utr", async (req, reply) => {
    if (!requireRole(req, reply, ["ADMIN", "SUPER_ADMIN", "FINANCE"])) return;
    const { id } = req.params as { id: string };
    const { utr, paidAt, amount } = req.body as {
      utr?: string;
      paidAt?: string;
      amount?: number;
    };
    if (!utr || !String(utr).trim()) {
      return reply.code(400).send({ error: "utr is required" });
    }

    const existing = await prisma.invoice.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: "Invoice not found" });
    if (existing.status === "PAID") return { data: serializeInvoice(existing) };
    if (existing.status === "CANCELLED") {
      return reply.code(409).send({ error: "Invoice is cancelled" });
    }

    const balance = Math.max(0, existing.grandTotal - (existing.amountPaid ?? 0));
    const applied =
      amount != null ? Math.min(balance, Math.max(0, Math.round(Number(amount)))) : balance;
    const newPaid = Math.min(existing.grandTotal, (existing.amountPaid ?? 0) + applied);
    const fullyPaid = newPaid >= existing.grandTotal;

    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        utr: String(utr).trim(),
        amountPaid: newPaid,
        status: fullyPaid ? "PAID" : "PARTIALLY_PAID",
        paidAt: fullyPaid
          ? existing.paidAt ?? (paidAt ? new Date(paidAt) : new Date())
          : null,
      },
    });

    // Idempotent on `gatewayPaymentId`, so re-recording the same UTR is a no-op
    // rather than a duplicate Payment row.
    await recordInvoicePayment(updated, {
      gateway: "BANK_TRANSFER",
      gatewayPaymentId: `utr:${String(utr).trim()}`,
      method: "bank_transfer",
      amount: applied,
    });

    await emitEvent({
      code: fullyPaid ? "INVOICE_PAID" : "INVOICE_PARTIALLY_PAID",
      payload: { invoiceId: id, utr: String(utr).trim(), amount: applied },
      actor: req.user!.sub,
      engagementId: updated.engagementId ?? undefined,
    });

    return { data: serializeInvoice(updated) };
  });

  // PATCH /invoices/:id/status — admin-only workflow transition.
  app.patch("/invoices/:id/status", async (req, reply) => {
    if (!requireRole(req, reply, ["ADMIN"])) return;
    const { id } = req.params as { id: string };
    const { status } = req.body as { status?: string };

    // Accept the lowercase display form ("partially-paid") or the stored form
    // ("PARTIALLY_PAID") — the admin UI renders the lowercased variant.
    const normalized = String(status ?? "").trim().toUpperCase().replace(/-/g, "_");
    if (!INVOICE_STATUSES.includes(normalized)) {
      return reply.code(400).send({
        error: `Invalid status. Allowed: ${INVOICE_STATUSES.join(", ").toLowerCase()}`,
      });
    }

    const existing = await prisma.invoice.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: "Invoice not found" });

    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        status: normalized,
        ...(normalized === "PAID"
          ? {
              paidAt: existing.paidAt ?? new Date(),
              amountPaid: existing.grandTotal,
            }
          : {}),
      },
    });

    if (normalized === "PAID" && existing.status !== "PAID") {
      await recordInvoicePayment(updated, { gateway: "BANK_TRANSFER", method: "manual" });
    }

    await emitEvent({
      code: "INVOICE_STATUS_CHANGED",
      payload: { invoiceId: id, status: normalized },
      actor: req.user!.sub,
      engagementId: updated.engagementId ?? undefined,
    });

    return { data: serializeInvoice(updated) };
  });

  // Applies a captured gateway payment to an invoice: tracks the running
  // `amountPaid`, only flips to PAID on full settlement, and always books the
  // Payment row + rev-rec via recordInvoicePayment (the webhook paths used to
  // skip that entirely).
  async function applyGatewayPayment(
    invoiceId: string,
    capturedPaise: number,
    facts: Parameters<typeof recordInvoicePayment>[1],
  ) {
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice || invoice.status === "PAID" || invoice.status === "CANCELLED") return;

    const captured = Math.max(0, Math.round(capturedPaise) || 0);
    const newPaid = Math.min(invoice.grandTotal, (invoice.amountPaid ?? 0) + captured);
    const fullyPaid = newPaid >= invoice.grandTotal;

    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        amountPaid: newPaid,
        status: fullyPaid ? "PAID" : "PARTIALLY_PAID",
        paidAt: fullyPaid ? new Date() : null,
      },
    });

    await recordInvoicePayment(updated, { ...facts, amount: captured || undefined });

    await emitEvent({
      code: fullyPaid ? "INVOICE_PAID" : "INVOICE_PARTIALLY_PAID",
      payload: { invoiceId: invoice.id, gateway: facts.gateway, amount: captured },
      actor: "system",
      engagementId: updated.engagementId ?? undefined,
    });
  }

  // Razorpay webhook
  app.post("/webhooks/razorpay", async (req, reply) => {
    const signature = req.headers["x-razorpay-signature"] as string;
    if (!signature) return reply.code(400).send({ error: "Missing signature" });

    const body = (req as any).rawBody ?? JSON.stringify(req.body);
    if (!verifyRazorpaySignature(body, signature)) {
      return reply.code(400).send({ error: "Invalid signature" });
    }

    const payload = req.body as any;
    const eventType = payload.event;
    const entity = payload.payload?.payment?.entity;
    if (!entity) return reply.code(400).send({ error: "Invalid payload" });

    if (eventType === "payment.captured") {
      const rzpOrderId = entity.order_id;

      const invoice = await prisma.invoice.findFirst({
        where: { razorpayOrderId: rzpOrderId },
      });
      if (invoice) {
        await applyGatewayPayment(invoice.id, Number(entity.amount) || 0, {
          gateway: "RAZORPAY",
          gatewayPaymentId: entity.id,
          gatewayOrderId: rzpOrderId,
          method: entity.method ?? "unknown",
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

        // Retried webhooks are common — guard the manual Payment insert so a
        // second delivery does not create a duplicate row.
        const already = await prisma.payment.findFirst({
          where: { gatewayPaymentId: entity.id },
        });
        if (!already) {
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

  // Stripe webhook.
  //
  // Verified before it is trusted: with STRIPE_WEBHOOK_SECRET + the raw body we
  // check the signature; otherwise we re-fetch the event from Stripe's API by
  // id. Previously this endpoint trusted `req.body` as-is, so anyone who could
  // POST it could mark any invoice PAID.
  app.post("/webhooks/stripe", async (req, reply) => {
    const stripe = getStripe();
    if (!stripe) return reply.code(503).send({ error: "Stripe not configured" });

    const sigHeader = req.headers["stripe-signature"] as string | undefined;
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    const rawBody = (req as any).rawBody as string | undefined;
    let event = req.body as any;

    if (secret && sigHeader && rawBody) {
      try {
        event = stripe.webhooks.constructEvent(rawBody, sigHeader, secret);
      } catch {
        return reply.code(400).send({ error: "Invalid signature" });
      }
    } else {
      if (!event?.id || !String(event.id).startsWith("evt_")) {
        return reply.code(400).send({ error: "Unverifiable event" });
      }
      try {
        event = await stripe.events.retrieve(String(event.id));
      } catch {
        return reply.code(400).send({ error: "Unknown event" });
      }
    }

    if (event.type === "payment_intent.succeeded") {
      const pi = event.data?.object ?? {};
      const piId = pi.id;
      if (piId) {
        const invoice = await prisma.invoice.findFirst({
          where: { stripePaymentIntentId: piId },
        });
        if (invoice) {
          await applyGatewayPayment(
            invoice.id,
            Number(pi.amount_received ?? pi.amount) || 0,
            { gateway: "STRIPE", gatewayPaymentId: piId, method: "card" },
          );
        }
      }
    }
    return { ok: true };
  });

  // AR Aging.
  //
  // Bucketed by the invoice's due date (falling back to issue date), not by
  // `createdAt` — a NET-30 invoice used to land in the "31-60 days" bucket the
  // day after it was issued. Amounts are the outstanding balance, and every
  // open-receivable status is counted (partial and disputed included).
  app.get("/finance/ar-aging", async (req, reply) => {
    if (!requireRole(req, reply, ["ADMIN", "SUPER_ADMIN", "FINANCE", "SENIOR_PM", "PM"])) return;
    const invoices = await prisma.invoice.findMany({
      where: { status: { in: OPEN_RECEIVABLE } },
      orderBy: { createdAt: "asc" },
    });

    const now = Date.now();
    const buckets = { current: 0, d30: 0, d60: 0, d90: 0, d90plus: 0, totalOutstanding: 0 };
    for (const inv of invoices) {
      const outstanding = Math.max(0, (inv.grandTotal ?? 0) - (inv.amountPaid ?? 0));
      if (outstanding === 0) continue;
      buckets.totalOutstanding += outstanding;
      const anchor = (inv.dueDate ?? inv.createdAt).getTime();
      const days = Math.floor((now - anchor) / 86400000);
      if (days <= 0) buckets.current += outstanding;
      else if (days <= 30) buckets.d30 += outstanding;
      else if (days <= 60) buckets.d60 += outstanding;
      else if (days <= 90) buckets.d90 += outstanding;
      else buckets.d90plus += outstanding;
    }
    return { data: buckets };
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

  // GSTR-1 export.
  //
  // Filed on the invoice (time-of-supply) date, not the payment date — a March
  // invoice paid in April belongs in March's return, and an unpaid March
  // invoice must still appear. Month boundaries are computed in UTC so a
  // UTC-hosted server does not shift invoices between months. Rows are split
  // into B2B (recipient has a GSTIN) and B2CS.
  app.get("/finance/gstr1", async (req, reply) => {
    if (!requireRole(req, reply, ["ADMIN", "SUPER_ADMIN", "FINANCE", "SENIOR_PM", "PM"])) return;
    const { month, year } = req.query as { month?: string; year?: string };
    const m = parseInt(String(month ?? ""), 10);
    const y = parseInt(String(year ?? ""), 10);
    if (!(m >= 1 && m <= 12) || !(y >= 2000 && y < 3000)) {
      return reply.code(400).send({ error: "month (1-12) and year are required" });
    }

    const startDate = new Date(Date.UTC(y, m - 1, 1));
    const endDate = new Date(Date.UTC(y, m, 1)); // exclusive

    const invoices = await prisma.invoice.findMany({
      where: {
        createdAt: { gte: startDate, lt: endDate },
        status: { in: ["SENT", "VIEWED", "PARTIALLY_PAID", "PAID", "OVERDUE", "DISPUTED"] },
      },
      include: { org: true },
    });

    const rows = invoices.map((inv) => {
      const gstin = (inv.org as any)?.gstin ?? "";
      return {
        invoiceId: inv.id,
        invoiceDate: inv.createdAt.toISOString().slice(0, 10),
        section: gstin ? "B2B" : "B2CS",
        gstin,
        counterparty: (inv.org as any)?.name ?? "",
        sacCode: inv.sacCode,
        gstRate: inv.gstRate ?? 18,
        // legacy field names kept so the existing CSV export keeps working
        subtotal: inv.subtotal,
        taxableValue: inv.subtotal,
        igst: inv.igst,
        cgst: inv.cgst,
        sgst: inv.sgst,
        grandTotal: inv.grandTotal,
        invoiceValue: inv.grandTotal,
        paidAt: inv.paidAt,
      };
    });

    return {
      period: `${String(m).padStart(2, "0")}-${y}`,
      count: rows.length,
      data: rows,
      b2b: rows.filter((r) => r.section === "B2B"),
      b2cs: rows.filter((r) => r.section === "B2CS"),
    };
  });
}
