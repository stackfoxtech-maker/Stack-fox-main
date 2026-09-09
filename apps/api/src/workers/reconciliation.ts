import { registerCron } from "./cron/registry";
import { prisma } from "@stackfox/prisma";
import { emitEvent } from "../lib/events";

registerCron("invoice-reconcile", async () => {
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
