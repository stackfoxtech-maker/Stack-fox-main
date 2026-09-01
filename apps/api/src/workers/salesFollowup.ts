import { createWorker, QUEUE, queues } from "../lib/queue";
import { prisma } from "@stackfox/prisma";

/**
 * Sales follow-up reminders.
 *
 * Runs on a schedule (see lib/scheduler.ts). Finds PENDING follow-ups that are
 * due today or overdue and have not been reminded yet, notifies the assignee,
 * and stamps `reminderSentAt` so each follow-up nudges exactly once.
 */
createWorker(QUEUE.salesFollowup, async () => {
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const due = await prisma.followUp.findMany({
    where: {
      status: "PENDING",
      dueAt: { lte: endOfToday },
      reminderSentAt: null,
    },
    include: { lead: { select: { name: true, company: true } } },
    take: 200,
  });

  for (const f of due) {
    if (f.assignedTo) {
      await queues.notifications
        .add("sales-followup", {
          code: "SALES_FOLLOWUP_DUE",
          payload: {
            followUpId: f.id,
            leadId: f.leadId,
            lead: f.lead.company ?? f.lead.name,
            channel: f.channel,
            dueAt: f.dueAt.toISOString(),
            note: f.note,
          },
          userIds: [f.assignedTo],
        })
        .catch((err) => console.error("[salesFollowup] notify failed:", err.message));
    }
    await prisma.followUp.update({ where: { id: f.id }, data: { reminderSentAt: new Date() } });
  }

  if (due.length) console.log(`[salesFollowup] reminded ${due.length} follow-up(s)`);
});
