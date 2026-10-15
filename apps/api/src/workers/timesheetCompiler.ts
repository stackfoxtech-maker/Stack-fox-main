import { registerCron } from "./cron/registry";
import { prisma } from "@stackfox/prisma";
import { emitEvent } from "../lib/events";
import { istParts } from "../lib/ist";

registerCron("timesheet-weekly", async () => {
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

/** The Monday of the current week in IST, as a calendar date (UTC midnight). */
function getWeekStart(): Date {
  const { year, month, date, day } = istParts();
  const sinceMonday = day === 0 ? 6 : day - 1;
  return new Date(Date.UTC(year, month, date - sinceMonday));
}
