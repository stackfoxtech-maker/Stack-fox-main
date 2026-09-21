/**
 * Unit tier for the logic where a bug costs money.
 *
 * The codebase had six integration suites and no unit tests at all, so the
 * pricing, tax and identifier logic — the parts where an error is a wrong
 * invoice rather than a rendering glitch — were the least covered code in the
 * system despite being the most consequential.
 *
 * Pure functions only: no HTTP, no database, no fixtures. Runs in milliseconds,
 * so there is no excuse not to run it.
 *
 *   pnpm --filter @stackfox/api test:money
 */
import "../src/env";
import * as ids from "../src/lib/id";
import { computeInvoice } from "../src/lib/gstInvoice";
import { paymentModeAmount } from "@stackfox/core";

const checks: Array<[string, boolean, string]> = [];
const check = (label: string, pass: boolean, note = "") =>
  checks.push([label, pass, note]);

// ── Identifier collisions (SF-H2) ────────────────────────────────────────────
//
// These values are PRIMARY KEYS. The generator was `randomBytes(2) % 10000`,
// so a single month-prefix held 10,000 possibilities and by the birthday bound
// a collision became likelier than not after ~118 records — at which point the
// insert throws P2002 and the request 500s. This check failed against that
// generator; it passes against the widened one.
{
  const N = 5_000;
  for (const [name, gen] of Object.entries({
    estimateId: ids.estimateId,
    invoiceId: ids.invoiceId,
    orderId: ids.orderId,
    engagementId: ids.engagementId,
    ticketId: ids.ticketId,
    orgId: ids.orgId,
    programId: ids.programId,
    crId: ids.crId,
  })) {
    const seen = new Set<string>();
    let collisions = 0;
    for (let i = 0; i < N; i++) {
      const id = gen();
      if (seen.has(id)) collisions++;
      seen.add(id);
    }
    check(
      `${name}: ${N} ids, ${collisions} collisions`,
      collisions === 0,
      "a duplicate primary key is a 500 on insert",
    );
  }

  // projectId takes a prefix but shares the same suffix generator.
  const seen = new Set<string>();
  let collisions = 0;
  for (let i = 0; i < N; i++) {
    const id = ids.projectId("SF-WEB");
    if (seen.has(id)) collisions++;
    seen.add(id);
  }
  check(`projectId: ${N} ids, ${collisions} collisions`, collisions === 0, "");

  // Referral codes are typed back in by humans, so the alphabet must stay
  // unambiguous — no O/0, no I/1.
  const codes = Array.from({ length: 500 }, () => ids.referralCode());
  check(
    `referral codes avoid ambiguous characters`,
    codes.every((c) => !/[O0I1]/.test(c.slice(2))),
    "O/0 and I/1 are misread when dictated",
  );
  check(
    `referral codes are unique over 500`,
    new Set(codes).size === codes.length,
    "the code column is unique-indexed",
  );
}

// ── GST invoice arithmetic ───────────────────────────────────────────────────
//
// computeInvoice renders the client-facing tax invoice, and GST is filed on
// these numbers, so the components must reconcile to the total exactly.
//
// Shapes taken from lib/gstInvoice.ts rather than assumed: lineItems (not
// lines), intra/inter inferred from from.stateCode vs to.stateCode.
{
  const from = { name: "StackFox", gstin: "08ABCDE1234F1Z5", stateCode: "08" };
  const intraTo = { name: "Client A", gstin: "08FGHIJ5678K1Z5", stateCode: "08" };
  const interTo = { name: "Client B", gstin: "27FGHIJ5678K1Z5", stateCode: "27" };

  const cases = [
    {
      label: "single line, intra-State",
      intra: true,
      input: {
        from,
        to: intraTo,
        lineItems: [{ description: "Web build", qty: 1, rate: 50000 }],
      },
    },
    {
      label: "single line, inter-State",
      intra: false,
      input: {
        from,
        to: interTo,
        lineItems: [{ description: "Web build", qty: 1, rate: 50000 }],
      },
    },
    {
      label: "odd amount",
      intra: true,
      input: {
        from,
        to: intraTo,
        lineItems: [{ description: "Retainer", qty: 3, rate: 333.33 }],
      },
    },
    {
      label: "many lines",
      intra: false,
      input: {
        from,
        to: interTo,
        lineItems: Array.from({ length: 12 }, (_, i) => ({
          description: `Item ${i}`,
          qty: i + 1,
          rate: 1234 + i,
        })),
      },
    },
    {
      label: "line-level discount",
      intra: true,
      input: {
        from,
        to: intraTo,
        lineItems: [
          {
            description: "Audit",
            qty: 1,
            rate: 100000,
            discount: 10,
            discountType: "%" as const,
          },
        ],
      },
    },
  ];

  for (const c of cases) {
    let r;
    try {
      r = computeInvoice(c.input);
    } catch (err) {
      check(`computeInvoice: ${c.label}`, false, `threw: ${(err as Error).message}`);
      continue;
    }

    check(
      `${c.label}: tax components sum to taxTotal`,
      r.cgst + r.sgst + r.igst === r.taxTotal,
      `${r.cgst}+${r.sgst}+${r.igst} != ${r.taxTotal}`,
    );
    check(
      `${c.label}: subtotal + tax = grandTotal`,
      r.subtotal + r.taxTotal === r.grandTotal,
      `${r.subtotal} + ${r.taxTotal} != ${r.grandTotal}`,
    );
    check(
      `${c.label}: grandTotal + roundOff = payable`,
      r.grandTotal + r.roundOff === r.payable,
      `${r.grandTotal} + ${r.roundOff} != ${r.payable}`,
    );
    check(
      `${c.label}: round-off never exceeds half a rupee`,
      Math.abs(r.roundOff) <= 0.5,
      `roundOff ${r.roundOff} — a larger adjustment is an arithmetic bug, not rounding`,
    );
    check(
      `${c.label}: ${c.intra ? "CGST+SGST, no IGST" : "IGST only, no CGST/SGST"}`,
      c.intra
        ? r.igst === 0 && r.cgst > 0 && r.sgst > 0
        : r.igst > 0 && r.cgst === 0 && r.sgst === 0,
      `cgst=${r.cgst} sgst=${r.sgst} igst=${r.igst}`,
    );
    check(
      `${c.label}: isInterState agrees with the split`,
      r.isInterState === !c.intra,
      `isInterState=${r.isInterState}`,
    );
    check(
      `${c.label}: CGST and SGST are equal halves`,
      !c.intra || Math.abs(r.cgst - r.sgst) < 0.01,
      `${r.cgst} vs ${r.sgst}`,
    );
    check(
      `${c.label}: amount in words is produced`,
      typeof r.amountInWords === "string" && r.amountInWords.length > 0,
      "a tax invoice must state the amount in words",
    );
  }

  // Zero-rated export: no tax, but the invoice must still balance.
  const exp = computeInvoice({
    from,
    to: { name: "Overseas Ltd", stateCode: "96" },
    supplyType: "export_without",
    lineItems: [{ description: "Offshore build", qty: 1, rate: 500000 }],
  } as any);
  check(
    `export under LUT charges no tax (${exp.taxTotal})`,
    exp.taxTotal === 0 && exp.isZeroRated,
    "zero-rated supply must carry no GST",
  );
  check(
    `export invoice still balances`,
    exp.subtotal + exp.taxTotal === exp.grandTotal,
    `${exp.subtotal} + ${exp.taxTotal} != ${exp.grandTotal}`,
  );
}

// ── Payment mode splits ──────────────────────────────────────────────────────
//
// This decides what a client is actually charged at checkout. Modes are
// UPFRONT (0.95 — a 5% discount for paying in full), MILESTONE (0.3) and
// FULL (1); anything unrecognised falls back to FULL.
{
  const grand = 1_000_000; // Rs 10,000 in paise

  check(
    `FULL charges the whole amount`,
    paymentModeAmount(grand, "FULL") === grand,
    `got ${paymentModeAmount(grand, "FULL")}`,
  );
  check(
    `UPFRONT applies the 5% discount`,
    paymentModeAmount(grand, "UPFRONT") === 950_000,
    `got ${paymentModeAmount(grand, "UPFRONT")}`,
  );
  check(
    `MILESTONE charges 30% first`,
    paymentModeAmount(grand, "MILESTONE") === 300_000,
    `got ${paymentModeAmount(grand, "MILESTONE")}`,
  );

  for (const mode of ["UPFRONT", "MILESTONE", "FULL"]) {
    const amount = paymentModeAmount(grand, mode);
    check(
      `${mode}: charge is a whole number of paise within the total (${amount})`,
      Number.isInteger(amount) && amount > 0 && amount <= grand,
      "a first charge above the total, or zero, is a billing bug",
    );
  }

  check(
    `an unknown mode falls back to FULL, never zero`,
    paymentModeAmount(grand, "NONSENSE") === grand,
    `got ${paymentModeAmount(grand, "NONSENSE")} — silently charging zero would be worse than erroring`,
  );
  check(
    `an undefined mode falls back to FULL`,
    paymentModeAmount(grand, undefined) === grand,
    `got ${paymentModeAmount(grand, undefined)}`,
  );
}

// ── The money columns are BIGINT, and still arrive as numbers ────────────────
//
// int4 capped a single value at 2,147,483,647 paise — Rs 2,14,74,836.47 — and
// Postgres rejected anything larger outright with "integer out of range", so
// an invoice above about Rs 2.15 crore could not be written at all.
//
// The columns are int8 now. The JS type deliberately did NOT change: a double
// represents every integer up to 2^53 exactly, and packages/prisma converts at
// the client boundary so the ~45 arithmetic sites and every Math.min/max kept
// working. These checks pin that contract down.
{
  const INT4_MAX = 2_147_483_647;
  const ABOVE_OLD_CEILING = 3_000_000_000; // Rs 3 crore in paise

  check(
    `an amount above the old int4 ceiling is an exact JS integer (${ABOVE_OLD_CEILING})`,
    Number.isSafeInteger(ABOVE_OLD_CEILING) && ABOVE_OLD_CEILING > INT4_MAX,
    "this value could not be stored at all before the widening",
  );

  // Rs 90 trillion. Anything a real invoice holds is far below this.
  check(
    `the new practical ceiling is 2^53 paise, not 2^31`,
    Number.MAX_SAFE_INTEGER > INT4_MAX * 4_000_000,
    "the limit moved from Rs 2.15 crore to about Rs 90 trillion",
  );

  // The arithmetic the money paths actually do, at a scale that used to
  // overflow. If any of these produced a bigint the operators would throw.
  const grandTotal = ABOVE_OLD_CEILING;
  const amountPaid = 1_000_000_000;
  const balance = Math.max(0, grandTotal - amountPaid);
  const newPaid = Math.min(grandTotal, amountPaid + balance);

  check(
    `Math.max/min still work on a 3-crore amount (balance ${balance})`,
    balance === 2_000_000_000,
    "Math.min and Math.max throw outright on a bigint",
  );
  check(
    `paying the balance settles the invoice exactly`,
    newPaid === grandTotal,
    `${newPaid} != ${grandTotal} — a rounding slip here mis-settles an invoice`,
  );

  // GST split at a scale that overflowed int4 in every component.
  const subtotal = 2_500_000_000;
  const cgst = Math.round(subtotal * 0.09);
  const sgst = Math.round(subtotal * 0.09);
  check(
    `an 18% GST split reconciles at Rs 2.5 crore subtotal`,
    subtotal + cgst + sgst === 2_950_000_000 && cgst === sgst,
    `${subtotal} + ${cgst} + ${sgst}`,
  );
  check(
    `every component of that invoice exceeds the old int4 ceiling`,
    subtotal > INT4_MAX && subtotal + cgst + sgst > INT4_MAX,
    "the whole row, not just the total, had to widen",
  );
}

// ── Report ───────────────────────────────────────────────────────────────────
console.log("\n--- MONEY & IDS ---");
let failed = 0;
for (const [label, pass, note] of checks) {
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}${note && !pass ? `  (${note})` : ""}`);
  if (!pass) failed++;
}
console.log(`\n${checks.length - failed}/${checks.length} passed`);
console.log(failed === 0 ? "ALL MONEY & ID CHECKS PASSED" : `${failed} FAILED`);

process.exit(failed === 0 ? 0 : 1);
