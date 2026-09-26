import { prisma } from "@stackfox/prisma";

/** Reconcile captured cash to the cash-recognition ledger under the invoice lock. */
export async function reconcileInvoiceRevenue(invoiceId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${invoiceId} FOR UPDATE`;
    const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice?.engagementId) return;
    const [payments, ledger] = await Promise.all([
      tx.payment.aggregate({
        where: { invoiceId, status: "CAPTURED" },
        _sum: { amount: true },
      }),
      tx.revrecLedger.aggregate({
        where: { invoiceId, type: "RECOGNIZED" },
        _sum: { recognised: true },
      }),
    ]);
    const delta = Number(payments._sum.amount ?? 0) - Number(ledger._sum.recognised ?? 0);
    if (delta === 0) return;
    await tx.revrecLedger.create({
      data: {
        invoiceId,
        engagementId: invoice.engagementId,
        recognised: delta,
        amount: delta,
        period: new Date().toISOString().slice(0, 7),
        type: "RECOGNIZED",
        description: `Captured-payment reconciliation for ${invoiceId}`,
      },
    });
  });
}
