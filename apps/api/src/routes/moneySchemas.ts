import { z } from "zod";
import { businessId, strictObject } from "../lib/validate";

/**
 * Write schemas for the paths that move money or settle invoices.
 *
 * These went first because an unvalidated field here is a wrong charge or a
 * wrongly-settled invoice, not a rendering glitch. The gateway handshake fields
 * in particular were read straight off `req.body as any` and passed into HMAC
 * verification.
 *
 * Deliberately NOT `.strict()` on the gateway callbacks: Razorpay adds fields
 * to its payloads over time, and rejecting an unknown key there would break
 * payment capture on their release schedule rather than ours. The signature is
 * the gate; the schema only asserts that what we read is present and a string.
 */

/** Razorpay's checkout handshake, as posted back by their SDK. */
export const RazorpayHandshakeSchema = z.object({
  razorpay_order_id: z.string().min(1).max(64),
  razorpay_payment_id: z.string().min(1).max(64),
  razorpay_signature: z.string().min(1).max(256),
});

export const VerifyPaymentSchema = RazorpayHandshakeSchema.extend({
  /** The invoice being settled. */
  paymentId: businessId,
});

export const CreateOrderSchema = strictObject({
  invoiceId: businessId,
});

/**
 * POST /checkout/:sid/complete.
 *
 * The handshake is optional — a pay-later or bank-transfer checkout completes
 * without one and leaves the invoice SENT. When present it must be complete,
 * because a half-supplied handshake cannot be verified and silently falling
 * through to "unpaid" would hide a real payment.
 */
export const CompleteCheckoutSchema = z
  .object({
    referralCode: z.string().max(32).optional(),
    razorpay_order_id: z.string().max(64).optional(),
    razorpay_payment_id: z.string().max(64).optional(),
    razorpay_signature: z.string().max(256).optional(),
  })
  .refine(
    (v) =>
      (!v.razorpay_payment_id && !v.razorpay_signature) ||
      (!!v.razorpay_payment_id && !!v.razorpay_signature),
    {
      message:
        "razorpay_payment_id and razorpay_signature must be supplied together, or not at all",
      path: ["razorpay_signature"],
    },
  );

export const StartCheckoutSchema = strictObject({
  estimateId: businessId,
  tier: z.enum(["STARTER", "GROWTH", "PREMIUM"]).optional(),
});

/** Manual settlement by finance — a bank transfer arriving out of band. */
export const RecordManualPaymentSchema = strictObject({
  /** Bank reference. Recorded verbatim, so bound it. */
  utr: z.string().min(1).max(64),
  amount: z.number().int().positive().optional(),
  method: z.string().max(32).optional(),
  note: z.string().max(1000).optional(),
});
