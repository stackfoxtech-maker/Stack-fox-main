import { randomBytes } from "crypto";

function pad(n: number, len = 4): string {
  return String(n).padStart(len, "0");
}

/**
 * Unambiguous alphabet — no O/0, no I/1. These ids get read aloud, typed into
 * support tickets and pasted into emails.
 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Random suffix for a business identifier.
 *
 * This was `randomBytes(2) % 10000` — four decimal digits, so 10,000 possible
 * values behind a year-month prefix. These values are PRIMARY KEYS for
 * Estimate, Order, Invoice, Ticket, Engagement, Org, Project and ChangeRequest,
 * and by the birthday bound a collision became more likely than not after about
 * 118 records in a single month. The insert then threw P2002 and the request
 * 500'd — and only 2 of 19 call sites retried.
 *
 * Eight characters from a 32-symbol alphabet is 2^40, about 1.1e12 values. The
 * 50% collision point moves from ~118 records per month to ~1.2 million, which
 * takes the failure out of the operating range entirely rather than making it
 * rarer.
 *
 * This is the interim fix. The durable one is a UUID primary key with a
 * sequence-backed display number — the shape `invoice_no` already uses — which
 * needs a data migration and is tracked separately.
 */
function nextSeq(): string {
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

const now = () => new Date();

export function estimateId(): string {
  const d = now();
  return `EST-${d.getFullYear()}-${pad(d.getMonth() + 1, 2)}-${nextSeq()}`;
}

export function orderId(): string {
  const d = now();
  return `ORD-${d.getFullYear()}-${pad(d.getMonth() + 1, 2)}-${nextSeq()}`;
}

export function invoiceId(): string {
  const d = now();
  return `INV-${d.getFullYear()}-${pad(d.getMonth() + 1, 2)}-${nextSeq()}`;
}

export function crId(): string {
  return `CR-${now().getFullYear()}-${nextSeq()}`;
}

export function ticketId(): string {
  return `TKT-${now().getFullYear()}-${nextSeq()}`;
}

export function engagementId(): string {
  return `ENG-${now().getFullYear()}-${nextSeq()}`;
}

export function programId(): string {
  // Was `% 100` — a hundred possible values, so programmes collided after
  // roughly a dozen. Same generator as everything else now.
  return `PGM-${now().getFullYear()}-${nextSeq()}`;
}

export function orgId(): string {
  return `ORG-${now().getFullYear()}-${nextSeq()}`;
}

export function projectId(servicePrefix: string): string {
  return `${servicePrefix}-${now().getFullYear()}-${nextSeq()}`;
}

/**
 * Referral codes are shown to humans and typed back in, so they use an
 * unambiguous alphabet (no O/0, I/1) and are checked for uniqueness by the
 * caller against the `referrals.code` unique index.
 */
export function referralCode(): string {
  return `SF${nextSeq()}`;
}
