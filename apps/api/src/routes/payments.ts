import type { FastifyInstance } from "fastify";
import { prisma } from "@stackfox/prisma";
import { emitEvent } from "../lib/events";
import {
  createRazorpayOrder,
  verifyRazorpaySignature,
  fetchCapturedPayment,
  fetchRazorpayOrder,
  assertPaymentInitiationEnabled,
} from "../lib/payments";
import { settleInvoice } from "../lib/billing";
import { requireAuth } from "../plugins/auth";
import { clientScope } from "../lib/scope";
import { parseBody } from "../lib/validate";
import { CreateOrderSchema, VerifyPaymentSchema } from "./moneySchemas";

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

    assertPaymentInitiationEnabled();

    const parsed = parseBody(req, reply, CreateOrderSchema);
    if (!parsed) return;
    const { invoiceId } = parsed;
    return prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${invoiceId} FOR UPDATE`;
        const invoice = await tx.invoice.findFirst({
          where: { id: invoiceId, ...(scope !== null ? { orgId: scope } : {}) },
        });
        if (!invoice) return reply.code(404).send({ message: "Invoice not found" });

        // Bill only what is still outstanding. A PARTIALLY_PAID invoice (settled in
        // part via a bank UTR) must not be charged its full grand total again, and a
        // PAID or CANCELLED one is not payable at all.
        const balance =
          invoice.status === "PAID" || invoice.status === "CANCELLED"
            ? 0
            : Math.max(0, Number(invoice.grandTotal) - Number(invoice.amountPaid ?? 0));
        if (balance < MIN_AMOUNT_PAISE) {
          return reply.code(400).send({
            message: `Nothing to pay, or amount below minimum (${MIN_AMOUNT_PAISE} paise)`,
          });
        }

        let order;
        try {
          if (invoice.razorpayOrderId) {
            order = await fetchRazorpayOrder(invoice.razorpayOrderId);
            if (
              Number(order.amount) !== balance ||
              order.currency !== "INR" ||
              order.status === "paid"
            ) {
              return reply.code(409).send({
                message:
                  "Existing gateway order requires reconciliation before another payment",
              });
            }
          } else
            order = await createRazorpayOrder(balance, "INR", `inv_${invoice.id}`, {
              invoiceId: invoice.id,
            });
        } catch (err: any) {
          // The Razorpay SDK throws { statusCode, error: { code, description } } —
          // not a plain Error — so the real reason lives in err.error.description,
          // not err.message (which is usually undefined for these).
          const description: string | undefined = err?.error?.description ?? err?.message;
          const statusCode: number | undefined = err?.statusCode;
          req.log.error(
            { razorpayError: err?.error ?? err, statusCode },
            "Razorpay order creation failed",
          );
          const authFailure =
            statusCode === 401 || /key_id|key_secret|auth/i.test(description ?? "");
          // A gateway 401 is not the caller's session; the web client signs the
          // user out on any 401. Report it as unavailable and keep deliberate
          // statuses such as the live-payments gate's 503.
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

        await tx.invoice.update({
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
      },
      { timeout: 30000, maxWait: 10000 },
    );
  });

  // POST /payments/verify — verify the Razorpay payment signature and mark the invoice paid
  app.post("/payments/verify", async (req, reply) => {
    // The HMAC over order_id|payment_id (signed with the key secret) is the real
    // gate here, but this still mutates an invoice — require a session too.
    if (!requireAuth(req, reply)) return;
    const scope = await clientScope(req, reply);
    if (scope === undefined) return;
    const verified = parseBody(req, reply, VerifyPaymentSchema);
    if (!verified) return;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, paymentId } =
      verified;

    const valid = verifyRazorpaySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    );
    if (!valid) {
      return reply.code(400).send({ message: "Signature verification failed" });
    }

    // Scoped like /create-order directly above. A valid signature is still the
    // real gate, but an unscoped findUnique broke the tenancy invariant the
    // rest of the codebase maintains.
    const invoice = await prisma.invoice.findFirst({
      where: { id: paymentId, ...(scope !== null ? { orgId: scope } : {}) },
    });
    if (!invoice || invoice.razorpayOrderId !== razorpay_order_id) {
      return reply.code(400).send({ message: "Order does not match this invoice" });
    }

    const captured = await fetchCapturedPayment(razorpay_payment_id, razorpay_order_id);
    const result = await settleInvoice(invoice.id, {
      gateway: "RAZORPAY",
      gatewayPaymentId: razorpay_payment_id,
      gatewayOrderId: razorpay_order_id,
      amount: captured.amount,
      method: captured.method,
    });
    if (!result.replayed)
      await emitEvent({
        code:
          result.invoice.status === "PAID" ? "INVOICE_PAID" : "INVOICE_PARTIALLY_PAID",
        payload: { invoiceId: invoice.id, amount: captured.amount },
        actor: "SYSTEM",
        engagementId: invoice.engagementId ?? undefined,
      });
    return {
      data: {
        success: true,
        invoiceId: invoice.id,
        status: result.invoice.status.toLowerCase(),
        replayed: result.replayed,
      },
    };
  });
}
