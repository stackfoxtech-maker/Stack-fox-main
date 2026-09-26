import type { FastifyInstance } from "fastify";
import { prisma } from "@stackfox/prisma";
import { requireRole } from "../plugins/auth";
import { LIST_CAP } from "../lib/http";

/** Company-wide aggregates — internal staff only. */
const ANALYTICS_ROLES = ["ADMIN", "FINANCE", "SENIOR_PM", "PM", "SALES", "SE"];

/**
 * Analytics figures leave this API in RUPEES.
 *
 * The client has two money units and cannot have one: the storefront
 * catalogue (shared/stackfox-data.json) is bundled into the browser in rupees,
 * while money columns are paise. Dashboard numbers are aggregates for humans,
 * so they convert here and the client formats them with formatINR().
 * Raw row money (invoices, payments) stays paise and uses formatPaise().
 */
function toRupees(paise: number | bigint) {
  return Number(paise) / 100;
}

export async function analyticsRoutes(app: FastifyInstance) {
  app.get("/analytics/overview", async (req, reply) => {
    if (!requireRole(req, reply, ANALYTICS_ROLES)) return;

    const [
      totalProjects,
      capturedPayments,
      activeClientOrgs,
      pendingInvoices,
      receivables,
    ] = await Promise.all([
      prisma.project.count(),
      prisma.payment.aggregate({
        where: { status: "CAPTURED" },
        _sum: { amount: true },
      }),
      // An "active client" is an org with a live engagement.
      //
      // This counted distinct orgIds on `orders`, which is always zero: the
      // Order row is only written by the /checkout/:sid session flow, and
      // nothing uses that flow. The live path is quote-based
      // (POST /quotes -> /quotes/:id/pay -> provisionQuote), which creates an
      // Engagement, Projects and an Invoice but never an Order. So the
      // dashboard reported 0 active clients while 11 orgs and 6 active
      // engagements existed — a correct count of the wrong table.
      //
      // Engagement is the right source: it is what provisioning actually
      // produces, and "has work in flight with us" is what the number is
      // meant to convey.
      prisma.engagement.findMany({
        where: { status: "ACTIVE" },
        select: { clientId: true },
        distinct: ["clientId"],
      }),
      prisma.invoice.count({
        where: {
          status: { in: ["SENT", "VIEWED", "PARTIALLY_PAID", "OVERDUE", "DISPUTED"] },
        },
      }),
      prisma.invoice.aggregate({
        where: {
          status: { in: ["SENT", "VIEWED", "PARTIALLY_PAID", "OVERDUE", "DISPUTED"] },
        },
        _sum: { grandTotal: true, amountPaid: true },
      }),
    ]);

    const activeClients = activeClientOrgs.length;
    const totalRevenue = toRupees(capturedPayments._sum.amount ?? 0);

    return {
      totalProjects,
      totalRevenue,
      activeClients,
      pendingInvoices,
      pendingAmount:
        (Number(receivables._sum.grandTotal ?? 0) -
          Number(receivables._sum.amountPaid ?? 0)) /
        100,
    };
  });

  app.get("/analytics/revenue", async (req, reply) => {
    if (!requireRole(req, reply, ANALYTICS_ROLES)) return;

    const now = new Date();
    const query = req.query as { from?: string; to?: string };
    const start = query.from
      ? new Date(`${query.from}T00:00:00Z`)
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
    const end = query.to ? new Date(`${query.to}T23:59:59.999Z`) : now;
    if (
      !Number.isFinite(start.getTime()) ||
      !Number.isFinite(end.getTime()) ||
      start > end ||
      end.getTime() - start.getTime() > 3660 * 86400000
    )
      return reply
        .code(400)
        .send({ message: "Invalid revenue date range (maximum ten years)" });
    const months: { label: string; value: number }[] = [];

    for (
      const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
      d <= end;
      d.setUTCMonth(d.getUTCMonth() + 1)
    ) {
      const label = d.toLocaleString("en-IN", {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      });
      months.push({ label, value: 0 });
    }

    const captures = await prisma.payment.findMany({
      where: {
        status: "CAPTURED",
        createdAt: { gte: start, lte: end },
      },
      select: { createdAt: true, amount: true },
    });

    for (const capture of captures) {
      const d = capture.createdAt;
      const label = d.toLocaleString("en-IN", {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      });
      const bucket = months.find((m) => m.label === label);
      if (bucket) bucket.value += toRupees(capture.amount);
    }

    return months;
  });

  app.get("/analytics/conversion", async (req, reply) => {
    if (!requireRole(req, reply, ANALYTICS_ROLES)) return;

    const [totalQuotes, paidQuotes] = await Promise.all([
      prisma.quote.count(),
      prisma.quote.count({ where: { status: "paid" } }),
    ]);

    const conversionRate =
      totalQuotes > 0 ? Math.round((paidQuotes / totalQuotes) * 100) : 0;

    return {
      totalQuotes,
      paidQuotes,
      conversionRate,
    };
  });

  app.get("/analytics/services", async (req, reply) => {
    if (!requireRole(req, reply, ANALYTICS_ROLES)) return;

    // Counted in the database, not in Node.
    //
    // This pulled every Project row with its joined ServiceUnit and reduced
    // them in a loop — the whole table over the wire, plus a service record
    // per project, to produce at most a few dozen counts. groupBy does the
    // same work where the rows already are.
    //
    // The service name still needs a second query because groupBy returns only
    // grouped columns and aggregates, but it is one bounded lookup for the
    // services that actually appear rather than a join on every project.
    const grouped = await prisma.project.groupBy({
      by: ["serviceId"],
      _count: { _all: true },
      orderBy: { _count: { serviceId: "desc" } },
      take: LIST_CAP,
    });

    const services = await prisma.serviceUnit.findMany({
      where: { id: { in: grouped.map((g) => g.serviceId) } },
      select: { id: true, name: true },
    });
    const nameById = new Map(services.map((s) => [s.id, s.name]));

    return grouped.map((g) => ({
      serviceId: g.serviceId,
      serviceName: nameById.get(g.serviceId) ?? g.serviceId,
      count: g._count._all,
    }));
  });
}
