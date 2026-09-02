/**
 * Outbound SMS / WhatsApp, for phone OTP and transactional alerts.
 *
 * Dependency-free like the mailer: each provider is a single fetch, so adding
 * one needs env vars, not a package. Configure exactly one:
 *
 *   MSG91_AUTH_KEY (+ optional MSG91_SENDER_ID / MSG91_OTP_TEMPLATE_ID)
 *     — India-focused OTP SMS. https://control.msg91.com
 *   WHATSAPP_BSP_URL (+ WHATSAPP_BSP_TOKEN)
 *     — the same WhatsApp Business endpoint whatsappCommerce already uses;
 *       sends the code as a plain text message.
 *
 * When none is set, the code is logged (dev) or the caller gets `configured:false`.
 */

export interface SmsResult {
  delivered: boolean;
  provider: "msg91" | "whatsapp" | "none";
  error?: string;
}

export function isSmsConfigured(): boolean {
  return Boolean(process.env.MSG91_AUTH_KEY || process.env.WHATSAPP_BSP_URL);
}

/** E.164-ish: keep digits, assume India (+91) for a bare 10-digit number. */
function normalisePhone(raw: string): string {
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits.replace(/^0+/, "");
}

async function viaMsg91(phone: string, code: string): Promise<SmsResult> {
  const authKey = process.env.MSG91_AUTH_KEY!;
  const templateId = process.env.MSG91_OTP_TEMPLATE_ID;

  try {
    // Template flow (preferred) vs. plain SMS fallback.
    const res = templateId
      ? await fetch("https://control.msg91.com/api/v5/otp", {
          method: "POST",
          headers: { authkey: authKey, "Content-Type": "application/json" },
          body: JSON.stringify({ template_id: templateId, mobile: phone, otp: code }),
        })
      : await fetch("https://control.msg91.com/api/v5/flow/", {
          method: "POST",
          headers: { authkey: authKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            sender: process.env.MSG91_SENDER_ID ?? "STKFOX",
            short_url: "0",
            mobiles: phone,
            message: `${code} is your StackFox verification code. It expires in 5 minutes.`,
          }),
        });

    if (!res.ok) {
      return { delivered: false, provider: "msg91", error: `${res.status} ${(await res.text()).slice(0, 200)}` };
    }
    return { delivered: true, provider: "msg91" };
  } catch (err) {
    return { delivered: false, provider: "msg91", error: (err as Error).message };
  }
}

async function viaWhatsApp(phone: string, code: string): Promise<SmsResult> {
  try {
    const res = await fetch(process.env.WHATSAPP_BSP_URL!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.WHATSAPP_BSP_TOKEN ?? ""}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone,
        type: "text",
        text: { body: `${code} is your StackFox verification code. It expires in 5 minutes.` },
      }),
    });
    if (!res.ok) {
      return { delivered: false, provider: "whatsapp", error: `${res.status} ${(await res.text()).slice(0, 200)}` };
    }
    return { delivered: true, provider: "whatsapp" };
  } catch (err) {
    return { delivered: false, provider: "whatsapp", error: (err as Error).message };
  }
}

export async function sendOtpSms(rawPhone: string, code: string): Promise<SmsResult> {
  const phone = normalisePhone(rawPhone);
  if (process.env.MSG91_AUTH_KEY) return viaMsg91(phone, code);
  if (process.env.WHATSAPP_BSP_URL) return viaWhatsApp(phone, code);
  return { delivered: false, provider: "none", error: "No SMS/WhatsApp provider configured" };
}
