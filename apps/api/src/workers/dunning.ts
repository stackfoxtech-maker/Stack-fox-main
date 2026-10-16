import { prisma } from "@stackfox/prisma";
import { registerCron } from "./cron/registry";
import { queues } from "../lib/queue";

const DUNNING_DAYS = [1, 7, 14, 30, 45, 60, 91];

registerCron("dunning-run", async () => {
  const overdueInvoices = await prisma.invoice.findMany({
    where: { status: "OVERDUE" },
  });

  for (const inv of overdueInvoices) {
    const daysPastDue = Math.floor(
      (Date.now() - (inv.dueDate ?? inv.createdAt).getTime()) / 86400000,
    );
    // The job runs daily; reminding every day is spam. Chase on set days only.
    if (!DUNNING_DAYS.includes(daysPastDue)) continue;

    let dunningLevel = "REMINDER";
    if (daysPastDue > 90) dunningLevel = "FINAL_NOTICE";
    else if (daysPastDue > 60) dunningLevel = "ESCALATION";
    else if (daysPastDue > 30) dunningLevel = "FOLLOW_UP";

    await queues.notifications.add("dunning", {
      code: "DUNNING_NOTICE",
      payload: {
        invoiceId: inv.id,
        amount: Number(inv.grandTotal) - Number(inv.amountPaid ?? 0),
        daysPastDue,
        level: dunningLevel,
      },
      engagementId: inv.engagementId,
    });
  }
});
