import { createWorker, QUEUE } from "../lib/queue";
import { prisma } from "@stackfox/prisma";

interface RevRecJob {
  invoiceId?: string;
  amount: number; // paise
  engagementId: string;
  milestoneRef?: string;
}

createWorker<RevRecJob>(QUEUE.revRec, async (job) => {
  const { invoiceId, amount, engagementId, milestoneRef } = job.data;

  await prisma.revrecLedger.create({
    data: {
      engagementId,
      invoiceId,
      // `recognised` is the ledger's canonical column; `amount` mirrors it so
      // reporting queries can read one field name across both ledgers.
      recognised: amount,
      amount,
      period: currentPeriod(),
      type: "RECOGNIZED",
      description: `Revenue recognized for ${milestoneRef ?? invoiceId ?? engagementId}`,
    },
  });
});

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
