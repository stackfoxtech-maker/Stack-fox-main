import Razorpay from "razorpay";
import { createHmac, timingSafeEqual } from "crypto";

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

/**
 * Verify a Razorpay *webhook* payload. Unlike the checkout handshake above,
 * webhooks are signed with the per-webhook secret configured in the Razorpay
 * dashboard (Settings → Webhooks), not the API key secret — and over the exact
 * raw request bytes, so pass `req.rawBody`, never a re-serialised object.
 */
export function verifyRazorpayWebhookSignature(rawBody: string, signature: string): boolean {
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
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Stripe = require("stripe");
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  } catch {
    console.error(
      "[payments] STRIPE_SECRET_KEY is set but the `stripe` package is not " +
        "installed. Stripe webhooks will be rejected. Run `pnpm --filter " +
        "@stackfox/api add stripe`, or unset STRIPE_SECRET_KEY.",
    );
    stripe = null;
  }
  return stripe;
}
