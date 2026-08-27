import { createWorker, QUEUE } from "../lib/queue";
import { prisma } from "@stackfox/prisma";
import { isSlaBreached, SLA_TARGETS } from "@stackfox/core";
import { emitEvent } from "../lib/events";

createWorker(QUEUE.slaCron, async () => {
  // A ticket that has been acknowledged has already had its first response, so
  // only genuinely unanswered tickets can breach the response target.
  const openTickets = await prisma.ticket.findMany({
    where: { status: "OPEN" },
  });

  for (const ticket of openTickets) {
    const severity = (ticket.severity as keyof typeof SLA_TARGETS) ?? "P3";
    const target = SLA_TARGETS[severity];
    if (!target) continue;

    // SLA_TARGETS is expressed in minutes.
    const elapsedMin = (Date.now() - ticket.createdAt.getTime()) / 60000;
    if (!isSlaBreached(severity, elapsedMin, "response")) continue;

    await emitEvent({
      code: "SLA_BREACHED",
      payload: {
        ticketId: ticket.id,
        severity,
        metric: "response",
        elapsedMin: Math.round(elapsedMin),
        targetMin: target.responseMin,
      },
      actor: "system",
      projectId: ticket.projectId ?? undefined,
      engagementId: ticket.engagementId ?? undefined,
    });
  }
});
