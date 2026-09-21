/**
 * Document integrity — the ledger, the access trail and the retention guard.
 *
 * These are the checks that turn "we intend not to lose it" into something you
 * can show an auditor. Each fails against the pre-session code.
 *
 * Storage-dependent assertions are gated on SUPABASE_URL, like the other
 * suites: without credentials the API returns 503 by design and there is
 * nothing to sign.
 *
 *   pnpm --filter @stackfox/api test:documents
 */
import "../src/env";
import { prisma } from "@stackfox/prisma";
import {
  recordDocument,
  verifyDocument,
  isRetainedDocument,
  sha256,
  DOWNLOAD_TTL_SEC,
} from "../src/lib/documentIntegrity";

const stamp = Date.now();
const storageEnv = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);

const checks: Array<[string, boolean, string]> = [];
const check = (label: string, pass: boolean, note = "") =>
  checks.push([label, pass, note]);

// ── Signed URLs must be short-lived ──────────────────────────────────────────
check(
  `default download TTL is ${DOWNLOAD_TTL_SEC}s`,
  DOWNLOAD_TTL_SEC <= 300,
  "expect <= 300s — a leaked URL used to stay valid for an hour",
);

// ── Ledger records the exact bytes ───────────────────────────────────────────
const docId = `TEST-DOC-${stamp}`;
const bytes = Buffer.from(`invoice bytes ${stamp}`, "utf8");
const expected = sha256(bytes);

const digest = await recordDocument({
  documentType: "INVOICE",
  documentId: docId,
  bytes,
  storageKey: `invoices/${docId}.pdf`,
});
check(
  `recordDocument returns the content hash`,
  digest === expected,
  `${digest} vs ${expected}`,
);

const entry = await prisma.documentLedger.findFirst({
  where: { documentType: "INVOICE", documentId: docId },
});
check(`ledger row written`, Boolean(entry), "expect a row");
check(`ledger stores the hash`, entry?.sha256 === expected, `got ${entry?.sha256}`);
check(
  `ledger stores the size`,
  entry?.sizeBytes === bytes.length,
  `got ${entry?.sizeBytes}`,
);

// ── Regeneration appends, never overwrites ───────────────────────────────────
const bytes2 = Buffer.from(`invoice bytes ${stamp} REGENERATED`, "utf8");
await recordDocument({
  documentType: "INVOICE",
  documentId: docId,
  bytes: bytes2,
  storageKey: `invoices/${docId}.pdf`,
});
const allVersions = await prisma.documentLedger.findMany({
  where: { documentType: "INVOICE", documentId: docId },
});
check(
  `regeneration appends a second row (${allVersions.length})`,
  allVersions.length === 2,
  "expect 2 — the ledger is append-only, history is the evidence",
);
check(
  `the two versions disagree`,
  new Set(allVersions.map((v) => v.sha256)).size === 2,
  "different bytes must produce different hashes",
);

// ── Retention guard ──────────────────────────────────────────────────────────
check(
  `a ledger-referenced key is protected`,
  await isRetainedDocument(`invoices/${docId}.pdf`),
  "the retention worker must refuse to delete this",
);
check(
  `an unrelated key is not protected`,
  !(await isRetainedDocument(`files/some-upload-${stamp}.png`)),
  "ordinary uploads must still be collectable",
);

// archiveKey must be protected too, not just the primary copy
const archId = `TEST-ARCH-${stamp}`;
await recordDocument({
  documentType: "CONTRACT",
  documentId: archId,
  bytes,
  storageKey: `contracts/${archId}.pdf`,
  archiveKey: `worm/contracts/${archId}.worm.pdf`,
});
check(
  `the archive copy is protected too`,
  await isRetainedDocument(`worm/contracts/${archId}.worm.pdf`),
  "expect protected",
);

// ── Verification distinguishes its outcomes ──────────────────────────────────
const noEntry = await verifyDocument("INVOICE", `NOPE-${stamp}`);
check(
  `unknown document -> NO_LEDGER_ENTRY`,
  noEntry.status === "NO_LEDGER_ENTRY",
  `got ${noEntry.status}`,
);

if (storageEnv) {
  const stored = await verifyDocument("INVOICE", docId);
  check(
    `verify reaches storage (${stored.status})`,
    stored.status === "MATCH" || stored.status === "MISMATCH",
    "expect a real comparison when storage is configured",
  );
} else {
  const unreadable = await verifyDocument("INVOICE", docId);
  check(
    `no storage configured -> UNREADABLE, not a crash (${unreadable.status})`,
    unreadable.status === "UNREADABLE",
    `got ${unreadable.status}`,
  );
}

// ── Cleanup ──────────────────────────────────────────────────────────────────
await prisma.documentLedger.deleteMany({
  where: { documentId: { in: [docId, archId] } },
});

// ── Report ───────────────────────────────────────────────────────────────────
console.log("\n--- DOCUMENT INTEGRITY ---");
let failed = 0;
for (const [label, pass, note] of checks) {
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}${note && !pass ? `  (${note})` : ""}`);
  if (!pass) failed++;
}
console.log(`\n${checks.length - failed}/${checks.length} passed`);
console.log(failed === 0 ? "ALL DOCUMENT INTEGRITY CHECKS PASSED" : `${failed} FAILED`);

await prisma.$disconnect();
process.exit(failed === 0 ? 0 : 1);
