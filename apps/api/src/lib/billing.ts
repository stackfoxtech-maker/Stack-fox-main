import { prisma } from "@stackfox/prisma";
import { queues } from "./queue";
import { toJson } from "./json";

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
  grandTotal: number;
};

/**
 * The bookkeeping every "invoice paid" path owes but none of them did: a
 * `Payment` row and a revenue-recognition ledger entry. Previously `Payment`
 * stayed permanently empty (11 paid invoices, 0 payments) and the revRec worker
 * had no trigger. Call this right after marking an invoice PAID.
 *
 * Idempotent on the gateway payment id and on the invoice's revRec entry, so
 * it is safe to call from a retried webhook.
 */
export async function recordInvoicePayment(invoice: InvoiceLike, facts: PaymentFacts): Promise<void> {
  const amount = facts.amount ?? invoice.grandTotal;

  // 1. Payment row — requires an Order (the schema relation is mandatory).
  if (invoice.orderId) {
    const already = facts.gatewayPaymentId
      ? await prisma.payment.findFirst({ where: { gatewayPaymentId: facts.gatewayPaymentId } })
      : null;
    if (!already) {
      await prisma.payment.create({
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
      await prisma.order
        .update({ where: { id: invoice.orderId }, data: { status: "PAID", paidAt: new Date() } })
        .catch(() => {});
    }
  }

  // 2. Revenue recognition — enqueue once per invoice.
  if (invoice.engagementId) {
    const existing = await prisma.revrecLedger.findFirst({
      where: { invoiceId: invoice.id, type: "RECOGNIZED" },
      select: { id: true },
    });
    if (!existing) {
      await queues.revRec
        .add("recognize", {
          invoiceId: invoice.id,
          amount,
          engagementId: invoice.engagementId,
          milestoneRef: invoice.milestoneRef ?? undefined,
        })
        .catch((err) => {
          console.warn(`[billing] revRec enqueue failed for ${invoice.id}:`, err.message);
        });
    }
  }
}
