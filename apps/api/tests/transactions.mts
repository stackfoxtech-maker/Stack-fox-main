/**
 * Transaction boundaries on the money and contract paths — finding A-3.
 *
 * The API had exactly one `$transaction` in it, and that one was a batch array
 * rather than an interactive transaction. Every other multi-write business
 * operation ran as independent statements, so a failure between two writes
 * left the database describing something that never happened: an invoice
 * marked PAID with no Payment row behind it, a StackFox signature attached to
 * a contract that was never executed.
 *
 * The only honest test is to force a failure *between* the writes and check
 * that neither landed. These do that by making the second write impossible —
 * a foreign key that cannot resolve — and then asserting the first one rolled
 * back too.
 *
 *   pnpm --filter @stackfox/api test:transactions
 */
import "../src/env";
import { prisma } from "@stackfox/prisma";
import { recordInvoicePaymentRows } from "../src/lib/billing";

const checks: Array<[string, boolean, string]> = [];
const check = (label: string, pass: boolean, note = "") =>
  checks.push([label, pass, note]);

const tag = Date.now().toString(36);

const org = await prisma.org.create({
  data: { id: `ORG-TX-${tag}`, name: `Tx ${tag}`, type: "COMPANY" },
});
const eng = await prisma.engagement.create({
  data: { id: `ENG-TX-${tag}`, clientId: org.id, model: "FPM", commercial: {} },
});

async function newInvoice(suffix: string) {
  return prisma.invoice.create({
    data: {
      id: `INV-TX-${tag}-${suffix}`,
      orgId: org.id,
      engagementId: eng.id,
      sacCode: "998314",
      gstType: "IGST",
      subtotal: 100_000,
      igst: 18_000,
      grandTotal: 118_000,
      status: "SENT",
    },
  });
}

try {
  // ── An invoice flip and its Payment row are one fact ──────────────────────
  //
  // Mirrors PATCH /invoices/:id/utr and applyGatewayPayment: mark the invoice
  // paid, then write the Payment row. The Payment is forced to fail by
  // pointing it at an order that does not exist, which the schema's mandatory
  // relation rejects.
  {
    const invoice = await newInvoice("a");

    let threw = false;
    try {
      await prisma.$transaction(async (tx) => {
        await tx.invoice.update({
          where: { id: invoice.id },
          data: { status: "PAID", amountPaid: 118_000, paidAt: new Date() },
        });
        await recordInvoicePaymentRows(
          tx,
          { ...invoice, orderId: `ORDER-DOES-NOT-EXIST-${tag}` },
          { gateway: "BANK_TRANSFER", method: "manual" },
        );
      });
    } catch {
      threw = true;
    }

    check(
      "a failing Payment write aborts the transaction",
      threw,
      "if this did not throw the test below proves nothing",
    );

    const after = await prisma.invoice.findUnique({ where: { id: invoice.id } });
    check(
      `the invoice is NOT left marked PAID (status=${after?.status})`,
      after?.status === "SENT",
      "this is A-3: the invoice used to flip to PAID and the payment to vanish",
    );
    check(
      `amountPaid is NOT left set (${after?.amountPaid})`,
      Number(after?.amountPaid ?? 0) === 0,
      "a partial write here means the books disagree with themselves",
    );

    const payments = await prisma.payment.count({
      where: { gatewayOrderId: `ORDER-DOES-NOT-EXIST-${tag}` },
    });
    check(`no orphan Payment row survived (${payments})`, payments === 0);
  }

  // ── The same operation, allowed to succeed ────────────────────────────────
  //
  // Without this the checks above would pass against a transaction that never
  // commits anything at all.
  {
    const invoice = await newInvoice("b");

    const fx = await prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id: invoice.id },
        data: { status: "PAID", amountPaid: 118_000, paidAt: new Date() },
      });
      // orderId null: no Payment row is possible, but the rev-rec decision and
      // the invoice flip must still commit.
      return recordInvoicePaymentRows(
        tx,
        { ...invoice, orderId: null },
        {
          gateway: "BANK_TRANSFER",
          method: "manual",
        },
      );
    });

    const after = await prisma.invoice.findUnique({ where: { id: invoice.id } });
    check(
      `the happy path does commit (status=${after?.status})`,
      after?.status === "PAID",
      "the control: rollback tests are meaningless if nothing ever commits",
    );
    check(
      "side effects are returned for the caller to enqueue, not enqueued inside",
      typeof fx.needsRevRec === "boolean" && fx.invoiceId === invoice.id,
      "a rolled-back transaction that already enqueued leaves a worker acting on nothing",
    );
    check(
      "rev-rec is flagged for an invoice that has no ledger entry yet",
      fx.needsRevRec === true,
    );
  }

  // ── A contract countersign is a signature AND a status change ─────────────
  {
    const contract = await prisma.contract.create({
      data: {
        id: `CON-TX-${tag}`,
        engagementId: eng.id,
        type: "MSA",
        status: "CLIENT_SIGNED",
      },
    });

    let threw = false;
    try {
      await prisma.$transaction(async (tx) => {
        const { count } = await tx.contract.updateMany({
          where: { id: contract.id, status: "CLIENT_SIGNED" },
          data: { status: "EXECUTED", executedAt: new Date() },
        });
        if (count !== 1) throw new Error("unexpected");
        // Forced failure: a signature for a user that does not exist.
        await tx.signature.create({
          data: {
            contractId: contract.id,
            signerUserId: `USER-DOES-NOT-EXIST-${tag}`,
            side: "STACKFOX",
            rail: "CLICK",
            evidence: {},
          },
        });
      });
    } catch {
      threw = true;
    }

    check("a failing signature write aborts the countersign", threw);

    const after = await prisma.contract.findUnique({ where: { id: contract.id } });
    check(
      `the contract is NOT left EXECUTED (status=${after?.status})`,
      after?.status === "CLIENT_SIGNED",
      "it used to be executed with the signature write failing after it",
    );
    const sigs = await prisma.signature.count({ where: { contractId: contract.id } });
    check(`no signature row survived (${sigs})`, sigs === 0);
  }

  // ── The conditional update closes the countersign race ────────────────────
  //
  // Two countersigns arriving together both passed the status read. The guard
  // now lives in the WHERE clause, so exactly one can match.
  {
    const contract = await prisma.contract.create({
      data: {
        id: `CON-RACE-${tag}`,
        engagementId: eng.id,
        type: "MSA",
        status: "CLIENT_SIGNED",
      },
    });

    const attempt = () =>
      prisma.contract.updateMany({
        where: { id: contract.id, status: "CLIENT_SIGNED" },
        data: { status: "EXECUTED", executedAt: new Date() },
      });

    const [a, b] = await Promise.all([attempt(), attempt()]);
    const winners = [a.count, b.count].filter((c) => c === 1).length;

    check(
      `exactly one of two concurrent countersigns matches (${a.count} + ${b.count})`,
      winners === 1,
      "both matching means two STACKFOX signatures on one contract",
    );
  }
} finally {
  await prisma.signature.deleteMany({ where: { contractId: { startsWith: `CON-` } } });
  await prisma.contract.deleteMany({ where: { engagementId: eng.id } });
  await prisma.invoice.updateMany({
    where: { orgId: org.id },
    data: { status: "CANCELLED" },
  });
  await prisma.payment.deleteMany({ where: { invoice: { orgId: org.id } } });
  await prisma.invoice.deleteMany({ where: { orgId: org.id } });
  await prisma.engagement.deleteMany({ where: { id: eng.id } });
  await prisma.org.deleteMany({ where: { id: org.id } });
  await prisma.$disconnect();
}

console.log("\n--- TRANSACTION BOUNDARIES ---");
let failed = 0;
for (const [label, pass, note] of checks) {
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}${note && !pass ? `  (${note})` : ""}`);
  if (!pass) failed++;
}
console.log(`\n${checks.length - failed}/${checks.length} passed`);
console.log(failed === 0 ? "ALL TRANSACTION CHECKS PASSED" : `${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
