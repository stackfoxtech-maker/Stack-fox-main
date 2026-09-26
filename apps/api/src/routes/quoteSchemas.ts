import { z } from "zod";
import { strictObject } from "../lib/validate";

/**
 * Schemas for the quote routes.
 *
 * The important one is the item list. `price` is accepted and **ignored** —
 * the handler re-prices every line from the catalogue, the same way the cart
 * does. It used to be trusted, and a quote's total becomes the grandTotal of
 * a real Invoice through provisionQuote.
 */

export const QuoteItemSchema = z
  .object({
    // Required now: without it a line cannot be priced server-side, and the
    // only alternative is trusting the number the client sent.
    itemId: z.string().trim().min(1, "each item needs an itemId").max(120),
    itemType: z.string().trim().max(40).optional(),
    quantity: z.number().int().positive().max(999).optional(),
    // Accepted for client compatibility, never read. The catalogue decides.
    name: z.string().trim().max(300).optional(),
    price: z.number().optional(),
  })
  .passthrough();

export const QuoteFromCartSchema = strictObject({
  items: z.array(QuoteItemSchema).min(1, "Cart is empty").max(200),
  tier: z.enum(["STARTER", "GROWTH", "PREMIUM"]).optional(),
});

export const UpdateQuoteSchema = strictObject({
  // Customer answers only. Payment state is owned exclusively by settlement.
  checkoutDetails: strictObject({
    account: z.record(z.string().max(120), z.unknown()).optional(),
    project: z.record(z.string().max(120), z.unknown()).optional(),
    paymentMode: z.enum(["UPFRONT", "MILESTONE", "FULL"]).optional(),
    engagementModel: z.string().max(40).optional(),
    docsAccepted: z.boolean().optional(),
    step: z.number().int().min(0).max(20).optional(),
    contractSigned: z.boolean().optional(),
    signatureName: z.string().trim().min(3).max(200).optional(),
    signedAt: z.string().datetime().optional(),
    contractTypes: z.array(z.string().max(40)).max(20).optional(),
    clauseSelections: z.record(z.string().max(120), z.unknown()).optional(),
  }).optional(),
  tier: z.enum(["STARTER", "GROWTH", "PREMIUM"]).optional(),
}).refine((b) => Object.keys(b).length > 0, {
  message: "Provide checkoutDetails or tier",
});

export const UpdateQuoteStatusSchema = strictObject({
  // Membership is checked against ALLOWED in the handler, which also decides
  // who may set what.
  status: z.string().trim().min(1).max(40),
});

export const QuotePaySchema = strictObject({
  paymentMode: z.enum(["UPFRONT", "MILESTONE", "FULL"]).optional(),
});

/**
 * The Razorpay handshake. These three go straight into an HMAC comparison, so
 * the shape matters more than the content — but an unbounded string reaching
 * a crypto compare is still worth refusing early.
 */
export const QuoteVerifyPaymentSchema = strictObject({
  razorpay_order_id: z.string().trim().min(1).max(200),
  razorpay_payment_id: z.string().trim().min(1).max(200),
  razorpay_signature: z.string().trim().min(1).max(500),
});
