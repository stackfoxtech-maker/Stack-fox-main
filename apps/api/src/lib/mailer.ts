/**
 * Outbound transactional email.
 *
 * Deliberately dependency-free: Resend's REST API is a single fetch, so adding
 * a provider needs an API key rather than a package. When no provider is
 * configured the message is logged instead of being dropped silently, which is
 * what makes password reset usable on a local checkout.
 */
import { webAppUrl } from "./urls";

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface MailResult {
  /** False when no provider is configured — the caller must not report success to the user. */
  delivered: boolean;
  provider: "resend" | "none";
  error?: string;
}

export function isMailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

function fromAddress(): string {
  return process.env.MAIL_FROM?.trim() || "StackFox <onboarding@resend.dev>";
}

export async function sendMail(msg: MailMessage): Promise<MailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { delivered: false, provider: "none", error: "RESEND_API_KEY is not set" };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: [msg.to],
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return { delivered: false, provider: "resend", error: `${res.status} ${body.slice(0, 300)}` };
    }
    return { delivered: true, provider: "resend" };
  } catch (err) {
    return { delivered: false, provider: "resend", error: (err as Error).message };
  }
}

// ── Templates ───────────────────────────────

const SHELL = (heading: string, body: string, cta: { label: string; url: string }, footer: string) => `
<!doctype html>
<html><body style="margin:0;padding:0;background:#faf8f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f5;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #ece7e1;border-radius:16px;padding:32px;">
        <tr><td>
          <p style="margin:0 0 24px;font-size:20px;font-weight:600;color:#1c1917;">stack<span style="color:#f97316;">fox</span></p>
          <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#1c1917;">${heading}</h1>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#57534e;">${body}</p>
          <a href="${cta.url}" style="display:inline-block;background:#f97316;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 24px;border-radius:12px;">${cta.label}</a>
          <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#a8a29e;">${footer}</p>
          <p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#a8a29e;word-break:break-all;">If the button does not work, paste this link into your browser:<br/>${cta.url}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

export function passwordResetEmail(to: string, token: string): MailMessage {
  const url = `${webAppUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  return {
    to,
    subject: "Reset your StackFox password",
    html: SHELL(
      "Reset your password",
      "We received a request to set a new password for your StackFox account. This link is good for one hour and can only be used once.",
      { label: "Set a new password", url },
      "If you did not request this, you can safely ignore this email — your password will not change.",
    ),
    text: `Reset your StackFox password\n\nOpen this link within the next hour to choose a new password:\n${url}\n\nIf you did not request this, ignore this email — your password will not change.`,
  };
}

export function otpEmail(to: string, code: string): MailMessage {
  return {
    to,
    subject: `${code} is your StackFox verification code`,
    html: `
<!doctype html>
<html><body style="margin:0;padding:0;background:#faf8f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f5;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #ece7e1;border-radius:16px;padding:32px;">
        <tr><td align="center">
          <p style="margin:0 0 24px;font-size:20px;font-weight:600;color:#1c1917;">stack<span style="color:#f97316;">fox</span></p>
          <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#1c1917;">Your verification code</h1>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#57534e;">Enter this code to continue. It expires in 5 minutes.</p>
          <p style="margin:0 0 20px;font-size:34px;font-weight:700;letter-spacing:8px;color:#1c1917;font-family:'SFMono-Regular',Consolas,monospace;">${code}</p>
          <p style="margin:0;font-size:13px;line-height:1.6;color:#a8a29e;">If you did not request this, you can ignore this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
    text: `Your StackFox verification code is ${code}\n\nIt expires in 5 minutes. If you did not request this, ignore this email.`,
  };
}

export function verifyEmailMessage(to: string, token: string): MailMessage {
  const url = `${webAppUrl()}/verify-email?token=${encodeURIComponent(token)}`;
  return {
    to,
    subject: "Verify your StackFox email",
    html: SHELL(
      "Confirm your email address",
      "Welcome to StackFox. Confirm this address to activate every part of your account. This link is valid for 24 hours.",
      { label: "Verify email", url },
      "If you did not create a StackFox account, you can ignore this email.",
    ),
    text: `Welcome to StackFox\n\nConfirm your email address within the next 24 hours:\n${url}\n\nIf you did not create a StackFox account, ignore this email.`,
  };
}
