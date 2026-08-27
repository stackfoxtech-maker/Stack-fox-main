import { createWorker, QUEUE } from "../lib/queue";
import { prisma } from "@stackfox/prisma";
import { queues } from "../lib/queue";

createWorker(QUEUE.harvestReminder, async (job) => {
  const pendingTimesheets = await prisma.timesheet.findMany({
    where: { status: "DRAFT" },
    include: { engagement: true },
  });

  for (const ts of pendingTimesheets) {
    const daysSinceCreated = Math.floor((Date.now() - ts.createdAt.getTime()) / 86400000);

    if (daysSinceCreated >= 3) {
      await queues.notifications.add("harvest-reminder", {
        code: "TIMESHEET_REMINDER",
        payload: {
          timesheetId: ts.id,
          weekStart: ts.weekStart.toISOString(),
          daysPending: daysSinceCreated,
        },
        engagementId: ts.engagementId,
      });
    }
  }
});
