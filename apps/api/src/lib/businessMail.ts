import { createHash } from "node:crypto";
import { prisma } from "@stackfox/prisma";
import type { Db } from "./billing";
import { sendMail, type MailMessage, type MailResult } from "./mailer";
import { webAppUrl } from "./urls";

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

/** Called inside the commercial transaction: no committed payment loses its receipt. */
export async function queueInvoiceEmail(
  db: Db,
  invoiceId: string,
  kind: "issued" | "receipt",
  reference: string,
  amount?: number,
) {
  const invoice = await db.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { org: { include: { users: { select: { id: true, email: true } } } } },
  });
  const rupees = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
      n / 100,
    );
  const subject =
    kind === "receipt"
      ? `Payment receipt — ${invoice.invoiceNo ?? invoice.id}`
      : `Invoice issued — ${invoice.invoiceNo ?? invoice.id}`;
  const body =
    kind === "receipt"
      ? `We received ${rupees(amount ?? 0)} against invoice ${invoice.invoiceNo ?? invoice.id}. Reference: ${reference}.`
      : `Invoice ${invoice.invoiceNo ?? invoice.id} is ready. Total: ${rupees(Number(invoice.grandTotal))}.`;
  for (const user of invoice.org.users) {
    if (!user.email) continue;
    const id = createHash("sha256")
      .update(`${kind}:${invoiceId}:${reference}:${user.id}`)
      .digest("hex");
    await db.$executeRaw`INSERT INTO business_mail (id,recipient,subject,body) VALUES (${id},${user.email},${subject},${body}) ON CONFLICT (id) DO NOTHING`;
  }
}

type PendingMail = {
  id: string;
  recipient: string;
  subject: string;
  body: string;
  attempts: number;
};
/** Leases prevent concurrent workers; provider key covers a crash after sending. */
export async function flushBusinessMail(
  send: (mail: MailMessage) => Promise<MailResult> = sendMail,
) {
  const rows = await prisma.$queryRaw<PendingMail[]>`
    UPDATE business_mail SET lease_until=now()+interval '5 minutes', attempts=attempts+1
    WHERE id IN (SELECT id FROM business_mail WHERE status='PENDING' AND next_attempt_at<=now()
      AND (lease_until IS NULL OR lease_until<now()) AND attempts<8
      ORDER BY created_at LIMIT 20 FOR UPDATE SKIP LOCKED)
    RETURNING id,recipient,subject,body,attempts`;
  for (const row of rows) {
    const url = `${webAppUrl()}/app/client/invoices`;
    const result = await send({
      to: row.recipient,
      subject: row.subject,
      text: `${row.body}\n\nView and download your invoice: ${url}`,
      html: `<h1>${escapeHtml(row.subject)}</h1><p>${escapeHtml(row.body)}</p><p><a href="${escapeHtml(url)}">View and download your invoice</a></p>`,
      idempotencyKey: `business-mail-${row.id}`,
    });
    if (result.delivered) {
      await prisma.$executeRaw`UPDATE business_mail SET status='SENT',sent_at=now(),lease_until=NULL,last_error=NULL WHERE id=${row.id}`;
    } else {
      const delay = Math.min(3600, 30 * 2 ** row.attempts);
      const status = row.attempts >= 8 ? "FAILED" : "PENDING";
      await prisma.$executeRaw`UPDATE business_mail SET status=${status},lease_until=NULL,last_error=${(result.error ?? "Delivery failed").slice(0, 500)},next_attempt_at=now()+${delay}*interval '1 second' WHERE id=${row.id}`;
    }
  }
  return rows.length;
}
