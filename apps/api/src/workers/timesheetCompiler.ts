import { createWorker, QUEUE } from "../lib/queue";
import { prisma } from "@stackfox/prisma";
import { emitEvent } from "../lib/events";

createWorker(QUEUE.timesheetCompiler, async (job) => {
  const activeEngagements = await prisma.engagement.findMany({
    where: { status: "ACTIVE", model: { in: ["TNM", "RET", "DED"] } },
  });

  const weekStart = getWeekStart();

  for (const eng of activeEngagements) {
    const existing = await prisma.timesheet.findFirst({
      where: { engagementId: eng.id, weekStart },
    });
    if (existing) continue;

    const timesheet = await prisma.timesheet.create({
      data: {
        engagementId: eng.id,
        weekStart,
        status: "DRAFT",
      },
    });

    await emitEvent({
      code: "TSHEET_CREATED",
      payload: { timesheetId: timesheet.id, engagementId: eng.id },
      actor: "system",
      engagementId: eng.id,
    });
  }
});

function getWeekStart(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(now.getFullYear(), now.getMonth(), diff);
}
