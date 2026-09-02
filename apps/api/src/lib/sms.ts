/**
 * Phone OTP via MSG91's managed OTP flow (v5).
 *
 * MSG91 generates, stores, rate-limits and verifies the code — we only ask it
 * to "send to this number" and later "is this code valid for this number".
 * No Redis needed for the phone path.
 *
 * Config:
 *   MSG91_AUTH_KEY            — required. The account auth key.
 *   MSG91_OTP_TEMPLATE_ID     — optional. A DLT-approved OTP template; if unset,
 *                               MSG91 uses the account's default OTP template.
 *   MSG91_SENDER_ID           — optional, defaults to "STKFOX".
 *
 * NOTE: MSG91 can IP-whitelist an auth key. If verify returns "IP is not
 * whitelisted", add the server's outbound IP in the MSG91 panel (or disable
 * the whitelist for this key).
 */

const BASE = "https://control.msg91.com/api/v5/otp";

export interface OtpResult {
  ok: boolean;
  error?: string;
}

export function isSmsConfigured(): boolean {
  return Boolean(process.env.MSG91_AUTH_KEY);
}

/** Digits only; a bare 10-digit number is assumed Indian (+91). */
export function normalisePhone(raw: string): string {
  const d = raw.replace(/[^\d]/g, "").replace(/^0+/, "");
  return d.length === 10 ? `91${d}` : d;
}

function authHeaders() {
  return { authkey: process.env.MSG91_AUTH_KEY as string, "Content-Type": "application/json" };
}

/** Ask MSG91 to send a fresh OTP to `phone`. */
export async function sendPhoneOtp(phone: string): Promise<OtpResult> {
  const mobile = normalisePhone(phone);
  const params = new URLSearchParams({ mobile, otp_length: "6", otp_expiry: "5" });
  if (process.env.MSG91_OTP_TEMPLATE_ID) params.set("template_id", process.env.MSG91_OTP_TEMPLATE_ID);
  if (process.env.MSG91_SENDER_ID) params.set("sender", process.env.MSG91_SENDER_ID);

  try {
    const res = await fetch(`${BASE}?${params}`, { method: "POST", headers: authHeaders(), body: "{}" });
    const body = (await res.json().catch(() => ({}))) as { type?: string; message?: string; request_id?: string };
    if (body.type === "success") return { ok: true };
    return { ok: false, error: body.message ?? `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/** Resend the current OTP (voice or text). */
export async function retryPhoneOtp(phone: string, channel: "text" | "voice" = "text"): Promise<OtpResult> {
  const params = new URLSearchParams({ mobile: normalisePhone(phone), retrytype: channel });
  try {
    const res = await fetch(`${BASE}/retry?${params}`, { method: "POST", headers: authHeaders() });
    const body = (await res.json().catch(() => ({}))) as { type?: string; message?: string };
    return body.type === "success" ? { ok: true } : { ok: false, error: body.message ?? `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/** Verify a code against MSG91's record for `phone`. */
export async function verifyPhoneOtp(phone: string, code: string): Promise<OtpResult> {
  const params = new URLSearchParams({ mobile: normalisePhone(phone), otp: code });
  try {
    const res = await fetch(`${BASE}/verify?${params}`, { method: "POST", headers: authHeaders() });
    const body = (await res.json().catch(() => ({}))) as { type?: string; message?: string };
    if (body.type === "success") return { ok: true };
    // "OTP not match", "OTP expired", "IP is not whitelisted", …
    return { ok: false, error: body.message ?? `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
