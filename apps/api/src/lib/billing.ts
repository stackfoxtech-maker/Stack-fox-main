import { prisma } from "@stackfox/prisma";
import { queues } from "./queue";
import { toJson } from "./json";
import { log } from "./logger";

/**
 * The transaction-scoped client, derived from the real one rather than from
 * `Prisma.TransactionClient` — the client is wrapped in a `$extends` for the
 * BigInt conversion, so the generated type no longer matches.
 */
export type Db = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

interface PaymentFacts {
  gateway: "RAZORPAY" | "STRIPE" | "BANK_TRANSFER";
  gatewayPaymentId?: string;
  gatewayOrderId?: string;
  method?: string;
  /** paise; defaults to the invoice grand total. */
  amount?: number;
}

type InvoiceLike = {
  id: string;
  orderId: string | null;
  engagementId: string | null;
  milestoneRef: string | null;
  // Postgres holds this as BIGINT since the money widening, so Prisma types it
  // as bigint even though packages/prisma hands back a number at runtime.
  // Accepting both means callers pass a row straight through.
  grandTotal: number | bigint;
};

/** What the caller still has to enqueue once the transaction has committed. */
export interface PaymentSideEffects {
  invoiceId: string;
  amount: number;
  engagementId: string | null;
  milestoneRef: string | null;
  /** False when a RECOGNIZED ledger row already exists for this invoice. */
  needsRevRec: boolean;
}

/**
 * The bookkeeping every "invoice paid" path owes: a `Payment` row and the
 * order mirrored to PAID. Previously `Payment` stayed permanently empty
 * (11 paid invoices, 0 payments).
 *
 * **Database writes only, and deliberately so.** This is meant to run inside
 * the same transaction that marks the invoice paid, so the two either both
 * land or neither does. Queue work is returned rather than performed — see
 * `enqueuePaymentSideEffects`, which must run *after* commit. A rolled-back
 * transaction that already enqueued a job produces a worker acting on data
 * that does not exist.
 *
 * Idempotent on the gateway payment id, so a retried webhook is safe.
 */
export async function recordInvoicePaymentRows(
  db: Db,
  invoice: InvoiceLike,
  facts: PaymentFacts,
): Promise<PaymentSideEffects> {
  const amount = facts.amount ?? Number(invoice.grandTotal);

  // 1. Payment row — requires an Order (the schema relation is mandatory).
  if (invoice.orderId) {
    const already = facts.gatewayPaymentId
      ? await db.payment.findFirst({
          where: { gatewayPaymentId: facts.gatewayPaymentId },
        })
      : null;
    if (!already) {
      await db.payment.create({
        data: {
          orderId: invoice.orderId,
          gateway: facts.gateway,
          gatewayPaymentId: facts.gatewayPaymentId,
          gatewayOrderId: facts.gatewayOrderId,
          amount,
          currency: "INR",
          status: "CAPTURED",
          method: facts.method,
          metadata: toJson({ invoiceId: invoice.id }),
        },
      });

      // Mirror onto the order so a fully-paid order stops looking PENDING.
      //
      // updateMany rather than update: the order may legitimately not exist
      // (a manually raised invoice), and inside a transaction a P2025 from
      // update() would roll back the payment row we just wrote. The previous
      // code swallowed that error with .catch(() => {}), which worked only
      // because there was no transaction to poison.
      await db.order.updateMany({
        where: { id: invoice.orderId },
        data: { status: "PAID", paidAt: new Date() },
      });
    }
  }

  // 2. Revenue recognition — decided here, enqueued after commit.
  let needsRevRec = false;
  if (invoice.engagementId) {
    const existing = await db.revrecLedger.findFirst({
      where: { invoiceId: invoice.id, type: "RECOGNIZED" },
      select: { id: true },
    });
    needsRevRec = !existing;
  }

  return {
    invoiceId: invoice.id,
    amount,
    engagementId: invoice.engagementId,
    milestoneRef: invoice.milestoneRef,
    needsRevRec,
  };
}

/**
 * The queue work that follows a recorded payment. Call this only once the
 * transaction has committed.
 *
 * Failures are logged and swallowed: the money is already recorded, and a
 * failed enqueue must not surface as a failed payment. The cron reconciler
 * picks up anything that is missed.
 */
export async function enqueuePaymentSideEffects(fx: PaymentSideEffects): Promise<void> {
  if (fx.needsRevRec && fx.engagementId) {
    await queues.revRec
      .add("recognize", {
        invoiceId: fx.invoiceId,
        amount: fx.amount,
        engagementId: fx.engagementId,
        milestoneRef: fx.milestoneRef ?? undefined,
      })
      .catch((err) => {
        log().warn({ err, invoiceId: fx.invoiceId }, "revRec enqueue failed");
      });
  }

  // Re-render the invoice PDF so the copy the client downloads reflects the
  // payment (amount received, nil balance) instead of the original demand.
  await queues.docGen
    .add("invoice-pdf", { type: "invoice", invoiceId: fx.invoiceId })
    .catch((err) => {
      log().warn({ err, invoiceId: fx.invoiceId }, "invoice pdf enqueue failed");
    });
}

/**
 * Convenience wrapper for callers that are not already inside a transaction:
 * opens one for the rows, then enqueues after it commits.
 *
 * Prefer `recordInvoicePaymentRows` directly when the caller is marking the
 * invoice paid in the same breath — that is the whole point of the split, and
 * using this wrapper there would leave the invoice update outside the
 * transaction that writes the payment.
 */
export async function recordInvoicePayment(
  invoice: InvoiceLike,
  facts: PaymentFacts,
): Promise<void> {
  const fx = await prisma.$transaction((tx) =>
    recordInvoicePaymentRows(tx, invoice, facts),
  );
  await enqueuePaymentSideEffects(fx);
}
