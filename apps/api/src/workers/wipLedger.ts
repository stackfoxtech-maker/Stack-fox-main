import { createWorker, QUEUE } from "../lib/queue";
import { prisma } from "@stackfox/prisma";

interface WipJob {
  engagementId: string;
  projectId?: string;
  hours: number;
  costRate?: number; // paise per hour
  description?: string;
}

createWorker<WipJob>(QUEUE.wipLedger, async (job) => {
  const { engagementId, projectId, hours, costRate, description } = job.data;

  const amount = Math.round(hours * (costRate ?? 200000));

  // Work accrues here and is relieved when the matching invoice is raised, so a
  // fresh entry is always accrued-but-not-yet-invoiced.
  await prisma.wipLedger.create({
    data: {
      engagementId,
      projectId,
      hours,
      amount,
      accrued: amount,
      invoiced: 0,
      wip: amount,
      period: currentPeriod(),
      description: description ?? `WIP entry for ${projectId ?? engagementId}`,
    },
  });
});

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
