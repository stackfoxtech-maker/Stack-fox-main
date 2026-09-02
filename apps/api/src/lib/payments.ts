import Razorpay from "razorpay";

let _razorpay: InstanceType<typeof Razorpay> | null = null;

function getRazorpay() {
  if (!_razorpay) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) return null;
    _razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }
  return _razorpay;
}

export const razorpay = { get instance() { return getRazorpay(); } };

export async function createRazorpayOrder(
  amountPaise: number,
  currency = "INR",
  receipt?: string,
  notes?: Record<string, string>,
) {
  const rz = getRazorpay();
  if (!rz) throw new Error("Razorpay not configured — set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET");
  return rz.orders.create({
    amount: amountPaise,
    currency,
    receipt: receipt ?? `rcpt_${Date.now()}`,
    notes: notes ?? {},
  });
}

export function verifyRazorpaySignature(
  bodyOrOrderId: string,
  signatureOrPaymentId: string,
  maybeSignature?: string,
): boolean {
  const { createHmac } = require("crypto");
  const secret = process.env.RAZORPAY_KEY_SECRET ?? "";
  let body: string;
  let signature: string;

  if (maybeSignature) {
    body = `${bodyOrOrderId}|${signatureOrPaymentId}`;
    signature = maybeSignature;
  } else {
    body = bodyOrOrderId;
    signature = signatureOrPaymentId;
  }

  const expected = createHmac("sha256", secret).update(body).digest("hex");
  return expected === signature;
}

/**
 * Verify a Razorpay *webhook* payload. Unlike the checkout handshake above,
 * webhooks are signed with the per-webhook secret configured in the Razorpay
 * dashboard (Settings → Webhooks), not the API key secret — and over the exact
 * raw request bytes, so pass `req.rawBody`, never a re-serialised object.
 */
export function verifyRazorpayWebhookSignature(rawBody: string, signature: string): boolean {
  const { createHmac, timingSafeEqual } = require("crypto");
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET ?? "";
  if (!secret || !signature || !rawBody) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Stripe integration
let stripe: any = null;

export function getStripe() {
  if (!stripe && process.env.STRIPE_SECRET_KEY) {
    const Stripe = require("stripe");
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripe;
}

export async function createStripePaymentIntent(
  amountPaise: number,
  currency = "inr",
  metadata?: Record<string, string>,
) {
  const s = getStripe();
  if (!s) throw new Error("Stripe not configured");
  return s.paymentIntents.create({
    amount: amountPaise,
    currency,
    metadata: metadata ?? {},
  });
}
