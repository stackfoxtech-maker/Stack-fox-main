import { registerCron } from "./cron/registry";
import { prisma } from "@stackfox/prisma";
import { emitEvent } from "../lib/events";
import { flushBusinessMail } from "../lib/businessMail";
import { reconcileInvoiceRevenue } from "../lib/revenue";

registerCron("invoice-reconcile", async () => {
  await flushBusinessMail();
  // Recover lost queue submissions as well as duplicate/retried worker jobs.
  const unreconciled = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT i.id FROM invoices i WHERE i.engagement_id IS NOT NULL
    AND COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id=i.id AND p.status='CAPTURED'),0)
      <> COALESCE((SELECT SUM(r.recognised) FROM revrec_ledger r WHERE r.invoice_id=i.id AND r.type='RECOGNIZED'),0)
    LIMIT 100`;
  for (const invoice of unreconciled) await reconcileInvoiceRevenue(invoice.id);
  const overdueInvoices = await prisma.invoice.findMany({
    where: {
      status: "SENT",
      createdAt: { lt: new Date(Date.now() - 30 * 86400000) },
    },
  });

  for (const inv of overdueInvoices) {
    await prisma.invoice.update({
      where: { id: inv.id },
      data: { status: "OVERDUE" },
    });

    await emitEvent({
      code: "INVOICE_OVERDUE",
      payload: {
        invoiceId: inv.id,
        daysPastDue: Math.floor((Date.now() - inv.createdAt.getTime()) / 86400000),
      },
      actor: "system",
      engagementId: inv.engagementId ?? undefined,
    });
  }
});
