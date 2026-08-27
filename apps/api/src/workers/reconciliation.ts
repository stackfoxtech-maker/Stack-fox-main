import { createWorker, QUEUE } from "../lib/queue";
import { prisma } from "@stackfox/prisma";
import { emitEvent } from "../lib/events";

createWorker(QUEUE.reconciliation, async (job) => {
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
      payload: { invoiceId: inv.id, daysPastDue: Math.floor((Date.now() - inv.createdAt.getTime()) / 86400000) },
      actor: "system",
      engagementId: inv.engagementId ?? undefined,
    });
  }
});
