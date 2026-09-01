import { createWorker, QUEUE } from "../lib/queue";
import { prisma } from "@stackfox/prisma";
import { toJson } from "../lib/json";

interface SoftexJob {
  /** Omitted by the quarterly scheduler — then every eligible engagement is filed. */
  engagementId?: string;
  quarter?: number; // 1-4
  year?: number;
}

/** The quarter that closed most recently, relative to `now`. */
function lastClosedQuarter(now = new Date()): { quarter: number; year: number } {
  const q = Math.floor(now.getMonth() / 3) + 1; // 1-4, current quarter
  if (q === 1) return { quarter: 4, year: now.getFullYear() - 1 };
  return { quarter: q - 1, year: now.getFullYear() };
}

async function fileForEngagement(engagementId: string, quarter: number, year: number) {
  const engagement = await prisma.engagement.findUnique({
    where: { id: engagementId },
    select: { clientId: true },
  });
  if (!engagement) return;

  const period = `Q${quarter}-${year}`;

  // Idempotent: the quarterly scheduler can fire more than once (retry, manual
  // re-run) and must not stack duplicate filings.
  const existing = await prisma.complianceItem.findFirst({
    where: { engagementId, type: "SOFTEX", period },
    select: { id: true },
  });
  if (existing) return;

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
  if (invoices.length === 0) return;

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
      period,
      data: toJson(softexData),
      status: "GENERATED",
    },
  });
}

createWorker<SoftexJob>(QUEUE.softex, async (job) => {
  const { engagementId } = job.data;

  if (engagementId) {
    const { quarter, year } = job.data;
    const q = quarter ?? lastClosedQuarter().quarter;
    const y = year ?? lastClosedQuarter().year;
    await fileForEngagement(engagementId, q, y);
    return;
  }

  // Scheduler fan-out: file for every engagement that had a paid invoice in the
  // quarter that just closed.
  const { quarter, year } = lastClosedQuarter();
  const rows = await prisma.invoice.findMany({
    where: {
      status: "PAID",
      engagementId: { not: null },
      paidAt: {
        gte: new Date(year, (quarter - 1) * 3, 1),
        lt: new Date(year, quarter * 3, 1),
      },
    },
    select: { engagementId: true },
    distinct: ["engagementId"],
  });

  for (const row of rows) {
    if (!row.engagementId) continue;
    try {
      await fileForEngagement(row.engagementId, quarter, year);
    } catch (err) {
      console.error(`[softex] Q${quarter}-${year} failed for ${row.engagementId}:`, err);
    }
  }
});
