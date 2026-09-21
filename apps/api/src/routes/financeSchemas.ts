import { z } from "zod";
import { paise, strictObject } from "../lib/validate";

/**
 * Schemas for the finance write paths.
 *
 * The arithmetic here was already defensive — the applied amount is clamped to
 * `[0, balance]` before it touches the row — so this is not fixing a
 * mis-payment. What it fixes is the shape: `paidAt` was any string, and
 * `new Date("last tuesday")` is an Invalid Date that Prisma rejects at the
 * driver. That surfaced as a 500 on a finance endpoint, where the honest
 * answer is a 400 naming the field.
 *
 * The two webhook handlers keep their `as any`, deliberately. Both bodies are
 * signature-verified against the raw bytes before they are read, and both are
 * shapes Razorpay and Stripe own rather than shapes we define — a strict
 * schema there would reject a legitimate provider change and drop a real
 * payment notification. Verified-then-read is the right order for those.
 */

/**
 * A bank UTR. 12-22 alphanumerics covers NEFT/RTGS/IMPS references; the value
 * also becomes the idempotency key for the Payment row
 * (`gatewayPaymentId: utr:<value>`), so an unbounded string would be an
 * unbounded key.
 */
export const RecordUtrSchema = strictObject({
  utr: z
    .string()
    .trim()
    .min(6, "A bank reference is required")
    .max(40)
    .regex(/^[A-Za-z0-9-]+$/, "A bank reference contains only letters, digits and hyphens"),
  // Omitted means "now"; the handler clamps the amount to the outstanding
  // balance either way.
  amount: paise.optional(),
  paidAt: z
    .string()
    .datetime({ offset: true })
    .or(z.string().date())
    .optional(),
});

/**
 * Accepts the lowercase display form ("partially-paid") or the stored form
 * ("PARTIALLY_PAID"), because the admin UI renders the lowercased variant.
 * Membership is checked in the handler against INVOICE_STATUSES, which is the
 * single source of truth for that list.
 */
export const UpdateInvoiceStatusSchema = strictObject({
  status: z.string().trim().min(1).max(40),
});
