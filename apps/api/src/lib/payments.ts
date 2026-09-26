import Razorpay from "razorpay";
import { createHmac, timingSafeEqual } from "crypto";
import { log } from "./logger";

let _razorpay: InstanceType<typeof Razorpay> | null = null;

export function assertPaymentInitiationEnabled() {
  if (
    process.env.RAZORPAY_KEY_ID?.startsWith("rzp_live_") &&
    process.env.LIVE_PAYMENTS_ENABLED !== "true"
  ) {
    throw Object.assign(
      new Error("Live payments are disabled pending production money reconciliation"),
      { statusCode: 503 },
    );
  }
}

function getRazorpay() {
  if (!_razorpay) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) return null;
    _razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }
  return _razorpay;
}

export async function createRazorpayOrder(
  amountPaise: number,
  currency = "INR",
  receipt?: string,
  notes?: Record<string, string>,
) {
  if (!Number.isSafeInteger(amountPaise) || amountPaise < 100) {
    throw new Error("Payment amount must be an integer of at least 100 paise");
  }
  assertPaymentInitiationEnabled();
  const rz = getRazorpay();
  if (!rz)
    throw new Error(
      "Razorpay not configured — set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET",
    );
  return rz.orders.create({
    amount: amountPaise,
    currency,
    receipt: (receipt ?? `rcpt_${Date.now()}`).slice(0, 40),
    notes: notes ?? {},
  });
}

/** Constant-time hex comparison. Length is not secret; the digest is. */
function hmacMatches(expected: string, presented: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(presented);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function verifyRazorpaySignature(
  bodyOrOrderId: string,
  signatureOrPaymentId: string,
  maybeSignature?: string,
): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET ?? "";
  if (!secret) return false;
  let body: string;
  let signature: string;

  if (maybeSignature) {
    body = `${bodyOrOrderId}|${signatureOrPaymentId}`;
    signature = maybeSignature;
  } else {
    body = bodyOrOrderId;
    signature = signatureOrPaymentId;
  }

  // Was `expected === signature`, which short-circuits on the first differing
  // character and leaks the digest a byte at a time. The webhook verifier below
  // already did this correctly.
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  return hmacMatches(expected, signature);
}

/** The browser signature authenticates IDs, not capture status or amount. */
export async function fetchCapturedPayment(paymentId: string, orderId: string) {
  const rz = getRazorpay();
  if (!rz) throw new Error("Razorpay not configured");
  const payment = await rz.payments.fetch(paymentId);
  if (
    payment.order_id !== orderId ||
    payment.status !== "captured" ||
    payment.currency !== "INR"
  ) {
    throw new Error("Payment is not a captured INR payment for this order");
  }
  const amount = Number(payment.amount);
  if (!Number.isSafeInteger(amount) || amount <= 0)
    throw new Error("Invalid captured amount");
  return { amount, method: payment.method };
}

export async function fetchRazorpayOrder(orderId: string) {
  const rz = getRazorpay();
  if (!rz) throw new Error("Razorpay not configured");
  return rz.orders.fetch(orderId);
}

/**
 * Verify a Razorpay *webhook* payload. Unlike the checkout handshake above,
 * webhooks are signed with the per-webhook secret configured in the Razorpay
 * dashboard (Settings → Webhooks), not the API key secret — and over the exact
 * raw request bytes, so pass `req.rawBody`, never a re-serialised object.
 */
export function verifyRazorpayWebhookSignature(
  rawBody: string,
  signature: string,
): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET ?? "";
  if (!secret || !signature || !rawBody) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return hmacMatches(expected, signature);
}

// Stripe integration
let stripe: any = null;

/**
 * The `stripe` package is NOT a dependency of this app — only Razorpay is
 * wired up. Setting STRIPE_SECRET_KEY used to throw MODULE_NOT_FOUND on the
 * first line of the Stripe webhook handler, so every delivery 500'd and no
 * payment was ever recorded. Fail with something a human can act on instead.
 *
 * Decide one way or the other: add `stripe` to dependencies, or delete this
 * helper, routes/finance.ts#/webhooks/stripe and the STRIPE_* env vars.
 */
export function getStripe() {
  if (stripe || !process.env.STRIPE_SECRET_KEY) return stripe;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Stripe = require("stripe");
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  } catch (err) {
    log().error(
      { err },
      "STRIPE_SECRET_KEY is set but the `stripe` package is not installed. " +
        "Stripe webhooks will be rejected. Run `pnpm --filter @stackfox/api " +
        "add stripe`, or unset STRIPE_SECRET_KEY.",
    );
    stripe = null;
  }
  return stripe;
}
