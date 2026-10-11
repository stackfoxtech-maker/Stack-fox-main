/**
 * READ-ONLY report: which invoices and "paid" quotes have no money behind them.
 *
 * Answers "where did this ₹445 invoice come from?" and "why does it say paid?"
 * without changing anything. It issues SELECTs only — safe to point at the
 * production database (with a read-only role, ideally):
 *
 *   DATABASE_URL=<read-only url> pnpm --filter @stackfox/api audit:invoices
 *
 * For every non-draft invoice it prints the amount, status, captured gateway
 * payments, and — when the row is suspect — why (see invoiceIntegrityIssue).
 * Invoices whose total ×100 equals their source quote's total are reported as
 * LEGACY-UNIT rows: written when quotes were in rupees, so ₹44,500 became ₹445.
 *
 * Repairing them (void, re-issue, or correct) is a decision for the owner and
 * is deliberately not done here.
 */
import "../src/env";
import { prisma } from "@stackfox/prisma";
import { invoiceIntegrityIssue } from "../src/lib/invoiceIntegrity";

const rs = (paise: number) =>
  "₹" + (paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 });

try {
  const invoices = await prisma.invoice.findMany({
    where: { status: { notIn: ["DRAFT"] } },
    orderBy: { createdAt: "asc" },
    include: {
      org: { select: { name: true } },
      payments: { where: { status: "CAPTURED" }, select: { amount: true } },
    },
  });

  // Quote totals are paise since the F-1 migration; legacy invoices copied the
  // pre-migration rupee figure, so they are exactly 1/100 of the quote.
  const quotes = await prisma.quote.findMany({
    where: { status: { in: ["paid", "partially_paid"] } },
    select: {
      quoteNumber: true,
      total: true,
      invoiceId: true,
      razorpayOrderId: true,
      userId: true,
    },
  });
  const quoteTotals = new Set(quotes.map((q) => Number(q.total)));

  let suspect = 0;
  console.log("\n  INVOICES\n");
  for (const inv of invoices) {
    const captured = inv.payments.reduce((s, p) => s + Number(p.amount), 0);
    const grand = Number(inv.grandTotal);
    const issue = invoiceIntegrityIssue(inv, captured);
    const legacyUnit = quoteTotals.has(grand * 100);
    if (issue || legacyUnit) suspect++;
    console.log(
      [
        (issue || legacyUnit ? "✗" : "✓").padEnd(2),
        (inv.invoiceNo ?? inv.id).padEnd(24),
        inv.createdAt.toISOString().slice(0, 10),
        inv.status.padEnd(15),
        `total ${rs(grand)}`.padEnd(22),
        `received ${rs(captured)}`.padEnd(24),
        (inv.org?.name ?? "").slice(0, 28).padEnd(28),
        legacyUnit ? `LEGACY-UNIT (real amount likely ${rs(grand * 100)})` : "",
        issue ?? "",
      ].join("  "),
    );
  }

  console.log("\n  QUOTES MARKED PAID\n");
  for (const q of quotes) {
    const payments = await prisma.payment.findMany({
      where: {
        status: "CAPTURED",
        OR: [
          ...(q.razorpayOrderId ? [{ gatewayOrderId: q.razorpayOrderId }] : []),
          ...(q.invoiceId ? [{ invoiceId: q.invoiceId }] : []),
        ],
      },
      select: { amount: true },
    });
    const captured =
      q.razorpayOrderId || q.invoiceId
        ? payments.reduce((s, p) => s + Number(p.amount), 0)
        : 0;
    const ok = captured >= Number(q.total);
    if (!ok) suspect++;
    console.log(
      [
        (ok ? "✓" : "✗").padEnd(2),
        q.quoteNumber.padEnd(18),
        `total ${rs(Number(q.total))}`.padEnd(22),
        `received ${rs(captured)}`.padEnd(24),
        q.razorpayOrderId ? "" : "no gateway order — never went to payment",
      ].join("  "),
    );
  }

  console.log(`\n  ${suspect} row(s) need review. Nothing was changed.\n`);
} catch (err) {
  console.error("\n  Audit failed:", err, "\n");
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
