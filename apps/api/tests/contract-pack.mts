/**
 * The client's contract download is ONE PDF holding every contract of the
 * engagement, in a fixed order, each with its own signature block.
 *
 * Storage is stubbed with scripts/mock-storage.mjs and the real document code
 * runs in-process, so this exercises the actual query, wording, layout, upload
 * and signed-link path rather than a copy of it.
 *
 *   pnpm --filter @stackfox/api exec tsx tests/contract-pack.mts
 */
import "../src/env";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { inflateSync } from "node:zlib";
import { PDFDocument } from "pdf-lib";
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

const { buildAgreementPack, buildContractPdf } = await import("../src/lib/documents");
const { getPresignedDownload } = await import("../src/lib/storage");

const checks: Array<[string, boolean]> = [];
const check = (label: string, pass: boolean) => checks.push([label, pass]);
const stamp = Date.now();

/** Text drawn with the standard fonts is hex-encoded in Flate content streams. */
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
    for (const t of body.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) {
      out += Buffer.from(t[1], "hex").toString("latin1") + "\n";
    }
  }
  return out;
}
const fetchPdf = async (key: string) =>
  Buffer.from(await (await fetch(await getPresignedDownload(key))).arrayBuffer());

const email = `pack-${stamp}@example.com`;
const reg = await fetch(
  `${process.env.TEST_API_URL ?? "http://localhost:4000"}/auth/register`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Pack Owner", email, password: "PackPass123!ok" }),
  },
);
const rb = (await reg.json()) as any;
const orgId = rb.data.user.orgId as string;
const userId = rb.data.user.id as string;
await prisma.org.update({
  where: { id: orgId },
  data: { name: "Acme Traders Pvt Ltd", type: "PVT_LTD", gstin: "08ABFCA1595D1ZR" },
});

const svc = await prisma.serviceUnit.findFirst({ where: { status: "PUBLISHED" } });
const eng = await prisma.engagement.create({
  data: {
    id: ids.engagementId(),
    clientId: orgId,
    model: "FPM",
    commercial: { subtotal: 4950000, gst: 891000, total: 5841000 },
    status: "ACTIVE",
  },
});
const project = await prisma.project.create({
  data: {
    id: `SF-PK-${String(stamp).slice(-8)}`,
    name: "Acme storefront",
    engagementId: eng.id,
    serviceId: svc!.id,
    configSnapshot: {},
    status: "ACTIVE",
  },
});
await prisma.milestone.createMany({
  data: [
    { number: 1, name: "Design", pct: 30 },
    { number: 2, name: "Build", pct: 40 },
    { number: 3, name: "Launch", pct: 30 },
  ].map((m) => ({
    projectId: project.id,
    number: m.number,
    name: m.name,
    paymentPct: m.pct,
    deliverables: [],
  })),
});
// Created out of reading order on purpose: the pack must sort them.
const made: Record<string, string> = {};
for (const type of ["DPA", "NDA", "SOW", "IP_WFH", "MSA"]) {
  made[type] = (
    await prisma.contract.create({
      data: { engagementId: eng.id, type, status: "DRAFT" },
    })
  ).id;
}
await prisma.signature.create({
  data: {
    contractId: made.MSA,
    signerUserId: userId,
    side: "CLIENT",
    rail: "CLICK",
    evidence: { name: "Asha Mehta" },
  },
});

const key = await buildAgreementPack(eng.id);
check("a pack is built for the engagement", !!key && key.endsWith("agreement-pack.pdf"));
const pack = await fetchPdf(key!);
const doc = await PDFDocument.load(pack);
const text = pdfText(pack);

check(
  `it is a real PDF (${pack.length} bytes)`,
  pack.subarray(0, 5).toString() === "%PDF-",
);
check(
  `one cover plus at least one page per contract (${doc.getPageCount()} pages)`,
  doc.getPageCount() >= 6,
);
const titles = [
  "Master Service Agreement",
  "Statement of Work",
  "Non-Disclosure Agreement",
  "Intellectual Property Assignment",
  "Data Processing Agreement",
];
for (const title of titles) check(`it contains "${title}"`, text.includes(title));
// A heading is drawn as a line of its own; the titles also occur mid-sentence.
const order = titles.map((t) => text.lastIndexOf(`\n${t}\n`));
check(
  "documents run in reading order (MSA, SOW, NDA, IP, DPA)",
  order.every((v, i) => i === 0 || v > order[i - 1]),
);
check("the client's name is filled in", text.includes("Acme Traders Pvt Ltd"));
check("the client's GSTIN is filled in", text.includes("GSTIN 08ABFCA1595D1ZR"));
check("the project scope is filled in", text.includes("Acme storefront"));
check("the fee comes from the engagement (Rs 58,410.00)", text.includes("Rs 58,410.00"));
check(
  "the milestone schedule is listed",
  text.includes("Design") && text.includes("Launch") && text.includes("30%"),
);
check("the typed client signature is shown", text.includes("Asha Mehta"));
check("unsigned documents say so", text.includes("Awaiting signature"));
check("the supplier is identified", text.includes("ARTWALL LABS PRIVATE LIMITED"));
check(
  "no placeholder wording is left",
  !/Draft pending signature|TODO|lorem|undefined|null\b/i.test(text),
);

// ── A single contract is still available, and is just that contract ─────────
const oneKey = await buildContractPdf(made.NDA);
const oneText = pdfText(await fetchPdf(oneKey!));
check(
  "a single-contract copy has no cover and only that contract",
  oneText.includes("Non-Disclosure Agreement") &&
    !oneText.includes("Master Service Agreement") &&
    !oneText.includes("CONTENTS"),
);

// ── Signing changes the pack, because it is rebuilt every time ───────────────
await prisma.signature.create({
  data: {
    contractId: made.SOW,
    signerUserId: userId,
    side: "CLIENT",
    rail: "CLICK",
    evidence: { name: "Second Signer" },
  },
});
const again = pdfText(await fetchPdf((await buildAgreementPack(eng.id))!));
check("a later signature appears in the next download", again.includes("Second Signer"));

// ── An engagement with no contracts has nothing to download ──────────────────
const empty = await prisma.engagement.create({
  data: {
    id: ids.engagementId(),
    clientId: orgId,
    model: "FPM",
    commercial: {},
    status: "ACTIVE",
  },
});
check(
  "no contracts -> null, not an empty PDF",
  (await buildAgreementPack(empty.id)) === null,
);

await prisma.signature.deleteMany({ where: { contractId: { in: Object.values(made) } } });
await prisma.documentLedger.deleteMany({
  where: { documentId: { in: [`pack:${eng.id}`, ...Object.values(made)] } },
});
await prisma.contract.deleteMany({ where: { engagementId: eng.id } });
await prisma.milestone.deleteMany({ where: { projectId: project.id } });
await prisma.project.delete({ where: { id: project.id } });
await prisma.engagement.deleteMany({ where: { id: { in: [eng.id, empty.id] } } });
await prisma.user.deleteMany({ where: { email } });
await prisma.$disconnect();
mock.kill();

let failed = 0;
for (const [label, pass] of checks) {
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}`);
  if (!pass) failed++;
}
console.log(`${checks.length - failed}/${checks.length} passed`);
if (failed) process.exit(1);
console.log("ALL CONTRACT PACK CHECKS PASSED");
