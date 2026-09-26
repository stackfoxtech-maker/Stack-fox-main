import { createWorker, QUEUE } from "../lib/queue";
import { reconcileInvoiceRevenue } from "../lib/revenue";

interface RevRecJob {
  invoiceId?: string;
  amount: number; // paise
  engagementId: string;
  milestoneRef?: string;
}

createWorker<RevRecJob>(QUEUE.revRec, async (job) => {
  if (!job.data.invoiceId)
    throw new Error("Revenue recognition requires invoice payment evidence");
  await reconcileInvoiceRevenue(job.data.invoiceId);
});
