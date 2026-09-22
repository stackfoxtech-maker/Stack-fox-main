/**
 * Provisioning parity — the two paths must agree on policy.
 *
 * routes/checkout.ts and routes/quotes.ts each provision an engagement, and
 * they had diverged: checkout resolved GST from the client's GSTIN while
 * quotes hardcoded IGST. A client in StackFox's own State billed through the
 * quote path received an inter-State invoice on an intra-State supply — same
 * tax total, wrong split, wrong GSTR-1 section.
 *
 * Tier milestone schedules and contract sets were also duplicated verbatim in
 * both files. They agreed by luck, not by construction.
 *
 * These checks are pure — no HTTP, no fixtures — so they run in milliseconds
 * and fail loudly if either policy is ever forked again.
 *
 *   pnpm --filter @stackfox/api test:parity
 */
import "../src/env";
import {
  getContractTypes,
  getMilestoneTemplates,
  milestonePctTotal,
} from "@stackfox/core";
import { resolveGstType, splitGst } from "../src/lib/gst";

const checks: Array<[string, boolean, string]> = [];
const check = (label: string, pass: boolean, note = "") =>
  checks.push([label, pass, note]);

const TIERS = ["STARTER", "GROWTH", "PREMIUM"];

// ── Milestone schedules must bill the whole engagement ───────────────────────
for (const tier of TIERS) {
  const total = milestonePctTotal(tier);
  check(
    `${tier} milestones sum to 100% (${total})`,
    total === 100,
    "milestone invoices would not equal the engagement value",
  );

  const templates = getMilestoneTemplates(tier);
  check(
    `${tier} has at least one milestone`,
    templates.length > 0,
    "a tier with no milestones can never be invoiced",
  );
  check(
    `${tier} milestones all have deliverables`,
    templates.every((m) => m.deliverables.length > 0),
    "a milestone with nothing to deliver cannot be accepted",
  );
}

// An unknown tier must not silently produce an unbillable engagement.
check(
  `unknown tier falls back to a billable schedule (${milestonePctTotal("NONSENSE")})`,
  milestonePctTotal("NONSENSE") === 100,
  "expect the PREMIUM fallback both call sites relied on",
);

// ── Contract sets ────────────────────────────────────────────────────────────
for (const tier of TIERS) {
  const types = getContractTypes(tier);
  check(
    `${tier} has contracts (${types.join(", ")})`,
    types.length > 0,
    "expect at least one",
  );
  check(
    `${tier} contract types are unique`,
    new Set(types).size === types.length,
    "duplicates",
  );
}
check(
  `PREMIUM includes an NDA and a DPA`,
  ["NDA", "DPA"].every((t) => getContractTypes("PREMIUM").includes(t)),
  "premium clients expect both",
);

// ── GST resolution — the actual divergence ───────────────────────────────────
const SUPPLIER_STATE = (process.env.SUPPLIER_STATE_CODE ?? "08").trim();

const intraState = { gstin: `${SUPPLIER_STATE}ABCDE1234F1Z5`, billingAddress: {} };
const interState = { gstin: "27ABCDE1234F1Z5", billingAddress: {} };
const unknown = { gstin: null, billingAddress: {} };

check(
  `same-State client resolves CGST_SGST`,
  resolveGstType(intraState) === "CGST_SGST",
  `got ${resolveGstType(intraState)}`,
);
check(
  `other-State client resolves IGST`,
  resolveGstType(interState) === "IGST",
  `got ${resolveGstType(interState)}`,
);
check(
  `unknown State falls back to IGST`,
  resolveGstType(unknown) === "IGST",
  "claiming an intra-State supply we cannot prove is the worse error",
);

// The split must preserve the total exactly — paise cannot be lost to rounding.
for (const amount of [0, 1, 999, 1_000, 18_000, 123_457, 99_999_999]) {
  for (const type of ["CGST_SGST", "IGST"] as const) {
    const { cgst, sgst, igst } = splitGst(amount, type);
    check(
      `split preserves ${amount} paise as ${type}`,
      cgst + sgst + igst === amount,
      `${cgst}+${sgst}+${igst} != ${amount}`,
    );
  }
}

// An intra-State split must actually be halved, not dumped into one component.
const half = splitGst(18_001, "CGST_SGST");
check(
  `odd CGST/SGST split differs by at most 1 paisa (${half.cgst}/${half.sgst})`,
  Math.abs(half.cgst - half.sgst) <= 1 && half.igst === 0,
  "expect a near-even split with no IGST",
);

// ── Report ───────────────────────────────────────────────────────────────────
console.log("\n--- PROVISIONING PARITY ---");
let failed = 0;
for (const [label, pass, note] of checks) {
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}${note && !pass ? `  (${note})` : ""}`);
  if (!pass) failed++;
}
console.log(`\n${checks.length - failed}/${checks.length} passed`);
console.log(failed === 0 ? "ALL PROVISIONING PARITY CHECKS PASSED" : `${failed} FAILED`);

process.exit(failed === 0 ? 0 : 1);
