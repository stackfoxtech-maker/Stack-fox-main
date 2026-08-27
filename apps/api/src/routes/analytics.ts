import type { FastifyInstance } from "fastify";
import { prisma } from "@stackfox/prisma";
import { requireRole } from "../plugins/auth";

/** Company-wide aggregates — internal staff only. */
const ANALYTICS_ROLES = ["ADMIN", "SUPER_ADMIN", "FINANCE", "SENIOR_PM", "PM", "SALES", "SE"];

function toRupees(paise: number) {
  return paise / 100;
}

export async function analyticsRoutes(app: FastifyInstance) {
  app.get("/analytics/overview", async (req, reply) => {
    if (!requireRole(req, reply, ANALYTICS_ROLES)) return;

    const [
      totalProjects,
      paidInvoices,
      activeClientOrgs,
      pendingInvoices,
    ] = await Promise.all([
      prisma.project.count(),
      prisma.invoice.aggregate({
        where: { status: "PAID" },
        _sum: { grandTotal: true },
      }),
      prisma.order.findMany({
        select: { orgId: true },
        distinct: ["orgId"],
      }),
      prisma.invoice.count({
        where: { status: { in: ["SENT", "OVERDUE"] } },
      }),
    ]);

    const activeClients = activeClientOrgs.length;
    const totalRevenue = toRupees(paidInvoices._sum.grandTotal ?? 0);

    return {
      totalProjects,
      totalRevenue,
      activeClients,
      pendingInvoices,
    };
  });

  app.get("/analytics/revenue", async (req, reply) => {
    if (!requireRole(req, reply, ANALYTICS_ROLES)) return;

    const now = new Date();
    const months: { label: string; value: number }[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleString("default", { month: "short", year: "numeric" });
      months.push({ label, value: 0 });
    }

    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const paidInvoices = await prisma.invoice.findMany({
      where: {
        status: "PAID",
        paidAt: { gte: sixMonthsAgo },
      },
      select: { paidAt: true, grandTotal: true },
    });

    for (const inv of paidInvoices) {
      if (!inv.paidAt) continue;
      const d = new Date(inv.paidAt);
      const label = d.toLocaleString("default", { month: "short", year: "numeric" });
      const bucket = months.find((m) => m.label === label);
      if (bucket) bucket.value += toRupees(inv.grandTotal);
    }

    return months;
  });

  app.get("/analytics/conversion", async (req, reply) => {
    if (!requireRole(req, reply, ANALYTICS_ROLES)) return;

    const [totalQuotes, paidQuotes] = await Promise.all([
      prisma.quote.count(),
      prisma.quote.count({ where: { status: "paid" } }),
    ]);

    const conversionRate = totalQuotes > 0 ? Math.round((paidQuotes / totalQuotes) * 100) : 0;

    return {
      totalQuotes,
      paidQuotes,
      conversionRate,
    };
  });

  app.get("/analytics/services", async (req, reply) => {
    if (!requireRole(req, reply, ANALYTICS_ROLES)) return;

    const projects = await prisma.project.findMany({
      include: { service: true },
    });

    const stats: Record<string, { serviceId: string; serviceName: string; count: number }> = {};

    for (const p of projects) {
      const sid = p.serviceId;
      if (!stats[sid]) {
        stats[sid] = {
          serviceId: sid,
          serviceName: (p.service as any)?.name ?? sid,
          count: 0,
        };
      }
      stats[sid].count += 1;
    }

    return Object.values(stats).sort((a, b) => b.count - a.count);
  });
}
