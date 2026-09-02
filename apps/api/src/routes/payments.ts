import type { FastifyInstance } from "fastify";
import { prisma } from "@stackfox/prisma";
import { emitEvent } from "../lib/events";
import { createRazorpayOrder, verifyRazorpaySignature } from "../lib/payments";
import { recordInvoicePayment } from "../lib/billing";
import { requireAuth } from "../plugins/auth";
import { clientScope } from "../lib/scope";

const MIN_AMOUNT_PAISE = 100;

export async function paymentRoutes(app: FastifyInstance) {
  // POST /payments/create-order — create a Razorpay order for an invoice balance
  app.post("/payments/create-order", async (req, reply) => {
    // Was unauthenticated: any caller could probe invoice ids for their amounts
    // and stomp `razorpayOrderId` on an invoice mid-payment. Now a client may
    // only create an order for an invoice billed to their own org.
    if (!requireAuth(req, reply)) return;
    const scope = await clientScope(req, reply);
    if (scope === undefined) return;

    const { invoiceId } = req.body as { invoiceId?: string };
    if (!invoiceId) return reply.code(400).send({ message: "invoiceId is required" });

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, ...(scope !== null ? { orgId: scope } : {}) },
    });
    if (!invoice) return reply.code(404).send({ message: "Invoice not found" });

    // Bill only what is still outstanding. A PARTIALLY_PAID invoice (settled in
    // part via a bank UTR) must not be charged its full grand total again, and a
    // PAID or CANCELLED one is not payable at all.
    const balance =
      invoice.status === "PAID" || invoice.status === "CANCELLED"
        ? 0
        : Math.max(0, invoice.grandTotal - (invoice.amountPaid ?? 0));
    if (balance < MIN_AMOUNT_PAISE) {
      return reply.code(400).send({ message: `Nothing to pay, or amount below minimum (${MIN_AMOUNT_PAISE} paise)` });
    }

    let order;
    try {
      order = await createRazorpayOrder(balance, "INR", `inv_${invoice.id}`, { invoiceId: invoice.id });
    } catch (err: any) {
      // The Razorpay SDK throws { statusCode, error: { code, description } } —
      // not a plain Error — so the real reason lives in err.error.description,
      // not err.message (which is usually undefined for these).
      const description: string | undefined = err?.error?.description ?? err?.message;
      const statusCode: number | undefined = err?.statusCode;
      req.log.error({ razorpayError: err?.error ?? err, statusCode }, "Razorpay order creation failed");
      const authFailure = statusCode === 401 || /key_id|key_secret|auth/i.test(description ?? "");
      return reply
        .code(authFailure ? 401 : 500)
        .send({ message: description ?? "Failed to create Razorpay order" });
    }

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { razorpayOrderId: order.id },
    });

    return {
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
        paymentId: invoice.id,
        invoiceNumber: invoice.id,
      },
    };
  });

  // POST /payments/verify — verify the Razorpay payment signature and mark the invoice paid
  app.post("/payments/verify", async (req, reply) => {
    // The HMAC over order_id|payment_id (signed with the key secret) is the real
    // gate here, but this still mutates an invoice — require a session too.
    if (!requireAuth(req, reply)) return;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, paymentId } = req.body as {
      razorpay_order_id?: string;
      razorpay_payment_id?: string;
      razorpay_signature?: string;
      paymentId?: string;
    };

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !paymentId) {
      return reply.code(400).send({ message: "razorpay_order_id, razorpay_payment_id, razorpay_signature and paymentId are all required" });
    }

    const valid = verifyRazorpaySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    if (!valid) {
      return reply.code(400).send({ message: "Signature verification failed" });
    }

    const invoice = await prisma.invoice.findUnique({ where: { id: paymentId } });
    if (!invoice || invoice.razorpayOrderId !== razorpay_order_id) {
      return reply.code(400).send({ message: "Order does not match this invoice" });
    }

    // This flow always creates an order for the full outstanding balance (see
    // /create-order), so the invoice is now settled — but the Payment row and
    // rev-rec entry must reflect what was actually charged in this transaction,
    // not the grand total, or an invoice part-paid by bank transfer first is
    // double-counted in the ledger.
    const charged = Math.max(0, invoice.grandTotal - (invoice.amountPaid ?? 0));

    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: "PAID",
        paidAt: new Date(),
        utr: razorpay_payment_id,
        amountPaid: invoice.grandTotal,
      },
    });

    await recordInvoicePayment(updated, {
      gateway: "RAZORPAY",
      gatewayPaymentId: razorpay_payment_id,
      gatewayOrderId: razorpay_order_id,
      amount: charged || undefined,
    });

    await emitEvent({
      code: "INVOICE_PAID",
      payload: { invoiceId: invoice.id, gateway: "razorpay", razorpayPaymentId: razorpay_payment_id },
      actor: "system",
      engagementId: updated.engagementId ?? undefined,
    });

    return { data: { success: true, invoiceId: invoice.id, status: "paid" } };
  });
}
