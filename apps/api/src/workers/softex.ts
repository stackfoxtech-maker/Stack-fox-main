import { createWorker, QUEUE } from "../lib/queue";
import { prisma } from "@stackfox/prisma";
import { toJson } from "../lib/json";

interface SoftexJob {
  engagementId: string;
  quarter: number; // 1-4
  year: number;
}

createWorker<SoftexJob>(QUEUE.softex, async (job) => {
  const { engagementId, quarter, year } = job.data;

  const engagement = await prisma.engagement.findUnique({
    where: { id: engagementId },
    select: { clientId: true },
  });
  if (!engagement) return;

  const invoices = await prisma.invoice.findMany({
    where: {
      engagementId,
      status: "PAID",
      paidAt: {
        gte: new Date(year, (quarter - 1) * 3, 1),
        lt: new Date(year, quarter * 3, 1),
      },
    },
    include: { org: true },
  });

  const softexData = invoices.map((inv) => ({
    invoiceId: inv.id,
    buyerName: inv.org.name,
    buyerCountry: (inv.org.billingAddress as Record<string, unknown>)?.country ?? "IN",
    sacCode: inv.sacCode,
    amount: inv.grandTotal,
    currency: "INR",
    paidAt: inv.paidAt?.toISOString(),
  }));

  await prisma.complianceItem.create({
    data: {
      orgId: engagement.clientId,
      type: "SOFTEX",
      engagementId,
      period: `Q${quarter}-${year}`,
      data: toJson(softexData),
      status: "GENERATED",
    },
  });
});
