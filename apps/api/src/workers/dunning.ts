import { createWorker, QUEUE } from "../lib/queue";
import { prisma } from "@stackfox/prisma";
import { queues } from "../lib/queue";

createWorker(QUEUE.dunning, async (job) => {
  const overdueInvoices = await prisma.invoice.findMany({
    where: { status: "OVERDUE" },
  });

  for (const inv of overdueInvoices) {
    const daysPastDue = Math.floor((Date.now() - inv.createdAt.getTime()) / 86400000);

    let dunningLevel = "REMINDER";
    if (daysPastDue > 90) dunningLevel = "FINAL_NOTICE";
    else if (daysPastDue > 60) dunningLevel = "ESCALATION";
    else if (daysPastDue > 30) dunningLevel = "FOLLOW_UP";

    await queues.notifications.add("dunning", {
      code: "DUNNING_NOTICE",
      payload: {
        invoiceId: inv.id,
        amount: inv.grandTotal,
        daysPastDue,
        level: dunningLevel,
      },
      engagementId: inv.engagementId,
    });
  }
});
