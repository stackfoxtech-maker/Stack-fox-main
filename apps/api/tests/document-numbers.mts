/**
 * Contracts, invoices and payment receipts carry real, sequential numbers:
 *
 *   AWL/INV/2026-27/0001   AWL/CON/2026-27/0001   AWL/RCP/2026-27/0001
 *
 * They used to be random (an invoice's printed number was the tail of its random id, contracts
 * had none, payments had no receipt). This runs the real allocator, the real PDF builders and
 * the real routes, with storage stubbed by scripts/mock-storage.mjs.
 *
 *   pnpm --filter @stackfox/api exec tsx tests/document-numbers.mts
 */
import "../src/env";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { inflateSync } from "node:zlib";
import { prisma } from "@stackfox/prisma";
import * as ids from "../src/lib/id";

const PORT = 54000 + Math.floor(Math.random() * 900);
const mock = spawn(
  process.execPath,
  [resolve(process.cwd(), "../../scripts/mock-storage.mjs")],
  {
    env: { ...process.env, MOCK_STORAGE_PORT: String(PORT) },
    stdio: "ignore",
  },
);
process.env.SUPABASE_URL = `http://127.0.0.1:${PORT}`;
process.env.SUPABASE_SECRET_KEY = "local-mock-key";
for (let i = 0; i < 30; i++) {
  try {
    await fetch(`http://127.0.0.1:${PORT}/`);
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 200));
  }
}

const { nextDocNumber, ensureInvoiceNo, financialYear, formatDocNumber } =
  await import("../src/lib/docNumber");
const { buildAgreementPack, buildInvoicePdf, buildReceiptPdf } =
  await import("../src/lib/documents");
const { getPresignedDownload } = await import("../src/lib/storage");

const BASE = process.env.TEST_API_URL ?? "http://localhost:4000";
const stamp = Date.now();
const checks: Array<[string, boolean]> = [];
const check = (label: string, pass: boolean) => checks.push([label, pass]);
const seqOf = (no: string) => Number(no.split("/")[3]);
const RE = (k: string) => new RegExp(`^AWL/${k}/\\d{4}-\\d{2}/\\d{4,}$`);

function pdfText(buf: Buffer): string {
  const raw = buf.toString("latin1");
  let out = "";
  for (const m of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    let body: string;
    try {
      body = inflateSync(Buffer.from(m[1], "latin1")).toString("latin1");
    } catch {
      continue;
    }
    for (const t of body.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g))
      out += Buffer.from(t[1], "hex").toString("latin1") + "\n";
  }
  return out;
}
const fetchPdf = async (key: string) =>
  Buffer.from(await (await fetch(await getPresignedDownload(key))).arrayBuffer());

// ── The financial year is April to March, in IST ────────────────────────────
check(
  "30 Mar 2027 is FY 2026-27",
  financialYear(new Date("2027-03-30T10:00:00Z")) === "2026-27",
);
check(
  "1 Apr 2027 (IST) starts FY 2027-28",
  financialYear(new Date("2027-03-31T19:00:00Z")) === "2027-28",
);
check(
  "31 Mar 2027 23:00 UTC is already 1 Apr in IST",
  financialYear(new Date("2027-03-31T23:00:00Z")) === "2027-28",
);
check(
  "1 Jan 2027 is still FY 2026-27",
  financialYear(new Date("2027-01-01T00:00:00Z")) === "2026-27",
);
check(
  "format is zero-padded to four digits",
  formatDocNumber("INV", "2026-27", 7) === "AWL/INV/2026-27/0007",
);

// ── The allocator: unique, consecutive, and gapless on rollback ─────────────
const first = await nextDocNumber(prisma, "CON");
const burst = await Promise.all(
  Array.from({ length: 25 }, () => nextDocNumber(prisma, "CON")),
);
const seqs = burst.map(seqOf).sort((a, b) => a - b);
check("25 concurrent requests get 25 different numbers", new Set(burst).size === 25);
check(
  "and they are consecutive, with no gap",
  seqs.every((n, i) => n === seqOf(first) + 1 + i),
);

let inTx = "";
try {
  await prisma.$transaction(async (tx) => {
    inTx = await nextDocNumber(tx, "RCP");
    throw new Error("rolled back on purpose");
  });
} catch {
  /* expected */
}
const afterRollback = await nextDocNumber(prisma, "RCP");
check(
  "a number taken inside a rolled-back transaction is handed out again",
  afterRollback === inTx,
);

// ── Invoices: a draft has no number; it is numbered when issued ─────────────
async function actor(tag: string, role: string) {
  const email = `num-${tag}-${stamp}@example.com`;
  const reg = await fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: `Num ${tag}`, email, password: "NumberPass123!ok" }),
  });
  const b = (await reg.json()) as any;
  await prisma.user.update({ where: { email }, data: { role } });
  const login = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "NumberPass123!ok" }),
  });
  return {
    token: ((await login.json()) as any).data.accessToken as string,
    orgId: b.data.user.orgId as string,
    email,
  };
}
const admin = await actor("admin", "ADMIN");
const owner = await actor("owner", "INDIVIDUAL_CLIENT");
await prisma.org.update({
  where: { id: owner.orgId },
  data: { name: "Numbers Trading Co" },
});
const call = (path: string, token: string, method = "GET", body?: unknown) =>
  fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

const mk = (status: string) =>
  prisma.invoice.create({
    data: {
      id: ids.invoiceId(),
      orgId: owner.orgId,
      sacCode: "998314",
      gstType: "IGST",
      subtotal: 100000,
      igst: 18000,
      grandTotal: 118000,
      status,
    },
  });
const draftA = await mk("DRAFT");
const draftB = await mk("DRAFT");
const draftC = await mk("DRAFT");
check("a new draft has no number", draftA.invoiceNo === null);

const issue = async (id: string, status: string) =>
  (await call(`/invoices/${id}/status`, admin.token, "PATCH", { status })).status;
check("issuing draft A succeeds", (await issue(draftA.id, "SENT")) === 200);
check("cancelling draft B succeeds", (await issue(draftB.id, "CANCELLED")) === 200);
check("issuing draft C succeeds", (await issue(draftC.id, "SENT")) === 200);
const [a, b, c] = await Promise.all(
  [draftA, draftB, draftC].map((d) =>
    prisma.invoice.findUniqueOrThrow({ where: { id: d.id } }),
  ),
);
check(
  "the issued invoice got an AWL/INV number",
  !!a.invoiceNo && RE("INV").test(a.invoiceNo),
);
check("a cancelled draft never took a number", b.invoiceNo === null);
check(
  "the next issued invoice is exactly one higher (the cancelled draft left no gap)",
  !!a.invoiceNo && !!c.invoiceNo && seqOf(c.invoiceNo) === seqOf(a.invoiceNo) + 1,
);

const race = await mk("SENT");
const nums = await Promise.all(
  Array.from({ length: 8 }, () => ensureInvoiceNo(prisma, race.id)),
);
check(
  "ten parallel first calls for one invoice all get the same single number",
  new Set(nums).size === 1,
);
const next = await nextDocNumber(prisma, "INV");
check(
  "and that took exactly one number from the series",
  seqOf(next) === seqOf(nums[0]!) + 1,
);

// The PDF prints the assigned number, not an invented one.
const invKey = await buildInvoicePdf(a.id);
const invText = pdfText(await fetchPdf(invKey!));
check("the invoice PDF prints its number", invText.includes(a.invoiceNo!));

// ── Receipts: one numbered receipt per captured payment ─────────────────────
const fin = await actor("fin", "FINANCE");
const pay = (utr: string, amount: number) =>
  call(`/invoices/${c.id}/utr`, fin.token, "PATCH", { utr, amount });
const p1 = await pay(`UTR${stamp}A`, 40000);
const p2 = await pay(`UTR${stamp}B`, 78000);
check("two part-payments are accepted", p1.status === 200 && p2.status === 200);
const payments = await prisma.payment.findMany({
  where: { invoiceId: c.id, status: "CAPTURED" },
  orderBy: { createdAt: "asc" },
});
check("both payments are captured", payments.length === 2);
check(
  "each has an AWL/RCP receipt number",
  payments.every((p) => !!p.receiptNo && RE("RCP").test(p.receiptNo)),
);
check(
  "receipt numbers are consecutive in payment order",
  payments.length === 2 &&
    seqOf(payments[1].receiptNo!) === seqOf(payments[0].receiptNo!) + 1,
);

const r1 = pdfText(await fetchPdf((await buildReceiptPdf(payments[0].id))!));
const r2 = pdfText(await fetchPdf((await buildReceiptPdf(payments[1].id))!));
check("receipt 1 prints its own number", r1.includes(payments[0].receiptNo!));
check("receipt 1 names the invoice it was paid against", r1.includes(c.invoiceNo!));
check("receipt 1 shows the amount received (Rs 400.00)", r1.includes("Rs 400.00"));
check("receipt 1 shows the balance left after it (Rs 780.00)", r1.includes("Rs 780.00"));
check(
  "receipt 2 prints a different number",
  r2.includes(payments[1].receiptNo!) && !r2.includes(payments[0].receiptNo!),
);
check("receipt 2 shows the invoice paid in full", /Nil - paid in full/.test(r2));
check("receipts show the client name", r1.includes("Numbers Trading Co"));

// The route: the owner can download it; another client cannot.
const dl = await call(`/payments/${payments[0].id}/receipt`, owner.token);
// 503 = the API under test has no storage configured; the PDF itself is covered above.
if (dl.status === 503)
  console.log("SKIP  receipt download link (API has no storage configured)");
else
  check(
    "the client can download their own receipt",
    dl.status === 200 && /^http/.test(((await dl.json()) as any).url ?? ""),
  );
const stranger = await actor("stranger", "INDIVIDUAL_CLIENT");
check(
  "another client gets 404, not the receipt",
  (await call(`/payments/${payments[0].id}/receipt`, stranger.token)).status === 404,
);
const inv = (await (await call(`/invoices/${c.id}`, owner.token)).json()) as any;
check(
  "the invoice payload lists both receipts with their numbers",
  inv.data.receipts?.length === 2 &&
    inv.data.receipts[0].receiptNo === payments[0].receiptNo,
);

// ── Contracts: numbered in the pack, in creation order ──────────────────────
const svc = await prisma.serviceUnit.findFirst({ where: { status: "PUBLISHED" } });
const eng = await prisma.engagement.create({
  data: {
    id: ids.engagementId(),
    clientId: owner.orgId,
    model: "FPM",
    commercial: {},
    status: "ACTIVE",
  },
});
await prisma.project.create({
  data: {
    id: `SF-NM-${String(stamp).slice(-8)}`,
    name: "Numbers project",
    engagementId: eng.id,
    serviceId: svc!.id,
    configSnapshot: {},
    status: "ACTIVE",
  },
});
const created: string[] = [];
for (const type of ["MSA", "SOW", "NDA"]) {
  const row = await prisma.contract.create({
    data: {
      engagementId: eng.id,
      type,
      status: "DRAFT",
      contractNo: await nextDocNumber(prisma, "CON"),
    },
  });
  created.push(row.contractNo!);
}
check(
  "contract numbers are consecutive",
  created.every((n, i) => i === 0 || seqOf(n) === seqOf(created[i - 1]) + 1),
);
// A contract from before numbering existed is numbered when its pack is built.
const legacy = await prisma.contract.create({
  data: { engagementId: eng.id, type: "DPA", status: "DRAFT" },
});
const packText = pdfText(await fetchPdf((await buildAgreementPack(eng.id))!));
for (const n of created) check(`the pack prints ${n}`, packText.includes(n));
const numbered = await prisma.contract.findUniqueOrThrow({ where: { id: legacy.id } });
check(
  "an un-numbered contract is numbered on first pack build",
  !!numbered.contractNo && RE("CON").test(numbered.contractNo),
);
check("and its number is in the PDF", packText.includes(numbered.contractNo!));

// ── Nothing in the database is left in the old random format ────────────────
const old = await prisma.$queryRaw<Array<{ n: bigint }>>`
  SELECT count(*) AS n FROM invoices WHERE invoice_no ~ '^AWL/INV/[0-9]{4}-[0-9]{2}/[0-9]{1,3}$'`;
check("no invoice still carries an old random-derived number", Number(old[0].n) === 0);
const dupes = await prisma.$queryRaw<Array<{ n: bigint }>>`
  SELECT count(*) AS n FROM (SELECT invoice_no FROM invoices WHERE invoice_no IS NOT NULL GROUP BY 1 HAVING count(*) > 1) d`;
check("no two invoices share a number", Number(dupes[0].n) === 0);

await prisma.$disconnect();
mock.kill();
let failed = 0;
for (const [label, pass] of checks) {
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}`);
  if (!pass) failed++;
}
console.log(`${checks.length - failed}/${checks.length} passed`);
if (failed) process.exit(1);
console.log("ALL DOCUMENT NUMBER CHECKS PASSED");
