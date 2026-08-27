import { createWorker, QUEUE } from "../lib/queue";
import { prisma } from "@stackfox/prisma";
import { emitEvent } from "../lib/events";

createWorker(QUEUE.renewalScanner, async (job) => {
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 86400000);

  const expiringEngagements = await prisma.engagement.findMany({
    where: {
      status: "ACTIVE",
      endsAt: { lte: thirtyDaysFromNow, gte: new Date() },
    },
  });

  for (const eng of expiringEngagements) {
    await emitEvent({
      code: "RENEWAL_DUE",
      payload: {
        engagementId: eng.id,
        expiresAt: eng.endsAt?.toISOString(),
        daysRemaining: Math.floor(((eng.endsAt?.getTime() ?? 0) - Date.now()) / 86400000),
      },
      actor: "system",
      engagementId: eng.id,
    });
  }
});
