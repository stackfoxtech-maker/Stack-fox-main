import type { FastifyInstance } from "fastify";
import { prisma } from "@stackfox/prisma";
import { requireRole } from "../plugins/auth";
import { ok } from "../lib/http";

/**
 * Business reporting for the admin dashboard.
 *
 * The admin Reports page offered four report types — revenue, projects, users,
 * services — but generated the *same* CSV for all four (a revenue series plus
 * an invoice list), and its date-range picker was never sent anywhere. Each
 * type below is a distinct query, and every one honours `from`/`to`.
 *
 * Amounts are stored in paise and returned in rupees.
 */

const INTERNAL = ["ADMIN", "SUPER_ADMIN", "FINANCE", "SENIOR_PM"];
const TYPES = ["revenue", "projects", "users", "services"] as const;
type ReportType = (typeof TYPES)[number];

const rupees = (paise: number) => Math.round(paise) / 100;

/** Parses `?from=&to=`, defaulting to the last six months. */
function range(q: Record<string, string | undefined>): { from: Date; to: Date } {
  const to = q.to ? new Date(`${q.to}T23:59:59.999Z`) : new Date();
  const from = q.from
    ? new Date(`${q.from}T00:00:00.000Z`)
    : new Date(to.getFullYear(), to.getMonth() - 5, 1);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw Object.assign(new Error("Invalid date range"), { statusCode: 400 });
  }
  return { from, to };
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Every month between two dates, so a series has no holes. */
function monthsBetween(from: Date, to: Date): string[] {
  const out: string[] = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
  while (cursor <= to) {
    out.push(monthKey(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return out;
}

// ── Builders ────────────────────────────────────────────────────────────────

async function revenueReport(from: Date, to: Date) {
  const invoices = await prisma.invoice.findMany({
    where: { createdAt: { gte: from, lte: to }, status: { not: "CANCELLED" } },
    include: { org: { select: { id: true, name: true } } },
  });

  const months = monthsBetween(from, to);
  const byMonth = new Map(months.map((m) => [m, { invoiced: 0, collected: 0 }]));
  for (const inv of invoices) {
    const b = byMonth.get(monthKey(inv.createdAt));
    if (b) b.invoiced += inv.grandTotal;
    if (inv.paidAt) {
      const p = byMonth.get(monthKey(inv.paidAt));
      if (p) p.collected += inv.grandTotal;
    }
  }

  // Revenue concentration matters commercially: one client at 60% is a risk.
  const byClient = new Map<string, { name: string; total: number; invoices: number }>();
  for (const inv of invoices) {
    const row = byClient.get(inv.orgId) ?? { name: inv.org.name, total: 0, invoices: 0 };
    row.total += inv.grandTotal;
    row.invoices += 1;
    byClient.set(inv.orgId, row);
  }

  const invoiced = invoices.reduce((s, i) => s + i.grandTotal, 0);
  const collected = invoices.filter((i) => i.status === "PAID").reduce((s, i) => s + i.grandTotal, 0);
  const gst = invoices.reduce((s, i) => s + i.cgst + i.sgst + i.igst, 0);

  const clients = [...byClient.entries()]
    .map(([orgId, r]) => ({
      orgId,
      client: r.name,
      invoices: r.invoices,
      revenue: rupees(r.total),
      sharePct: invoiced > 0 ? Math.round((r.total / invoiced) * 100) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  return {
    series: months.map((m) => ({
      label: m,
      month: m,
      invoiced: rupees(byMonth.get(m)!.invoiced),
      collected: rupees(byMonth.get(m)!.collected),
      value: rupees(byMonth.get(m)!.invoiced),
    })),
    clients,
    totals: {
      invoiced: rupees(invoiced),
      collected: rupees(collected),
      outstanding: rupees(invoiced - collected),
      gst: rupees(gst),
      invoiceCount: invoices.length,
      collectionRatePct: invoiced > 0 ? Math.round((collected / invoiced) * 100) : 0,
      topClientSharePct: clients[0]?.sharePct ?? 0,
    },
    columns: ["month", "invoiced", "collected"],
  };
}

async function projectsReport(from: Date, to: Date) {
  const projects = await prisma.project.findMany({
    where: { createdAt: { gte: from, lte: to } },
    include: {
      milestones: true,
      engagement: { include: { client: { select: { name: true } } } },
      service: { select: { name: true } },
    },
  });

  const now = new Date();
  const rows = projects.map((p) => {
    const approved = p.milestones.filter((m) => m.status === "APPROVED").length;
    const late = p.milestones.filter(
      (m) => m.status !== "APPROVED" && m.dueDate && new Date(m.dueDate.getTime() + 86400000) < now,
    ).length;
    return {
      projectId: p.id,
      project: p.name || p.id,
      client: p.engagement.client.name,
      service: p.service.name,
      status: p.status,
      milestones: p.milestones.length,
      approved,
      completionPct: p.milestones.length > 0 ? Math.round((approved / p.milestones.length) * 100) : 0,
      late,
      createdAt: p.createdAt,
    };
  });

  const byStatus = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  const completed = rows.filter((r) => r.status === "COMPLETED").length;

  return {
    series: monthsBetween(from, to).map((m) => ({
      label: m,
      month: m,
      value: rows.filter((r) => monthKey(r.createdAt) === m).length,
    })),
    projects: rows,
    byStatus,
    totals: {
      projects: rows.length,
      completed,
      completionRatePct: rows.length > 0 ? Math.round((completed / rows.length) * 100) : 0,
      milestones: rows.reduce((s, r) => s + r.milestones, 0),
      lateMilestones: rows.reduce((s, r) => s + r.late, 0),
      atRisk: rows.filter((r) => r.late > 0).length,
    },
    columns: ["projectId", "project", "client", "service", "status", "completionPct", "late"],
  };
}

async function usersReport(from: Date, to: Date) {
  const [users, orgs] = await Promise.all([
    prisma.user.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: { id: true, name: true, email: true, role: true, isActive: true, orgId: true, createdAt: true },
    }),
    prisma.org.findMany({ select: { id: true, name: true, healthState: true, createdAt: true } }),
  ]);

  const byRole = users.reduce<Record<string, number>>((acc, u) => {
    acc[u.role] = (acc[u.role] ?? 0) + 1;
    return acc;
  }, {});

  // Churn signal: Org.healthState is maintained from order recency and
  // outstanding invoices, so DORMANT/LOST are the accounts going cold.
  const byHealth = orgs.reduce<Record<string, number>>((acc, o) => {
    acc[o.healthState] = (acc[o.healthState] ?? 0) + 1;
    return acc;
  }, {});

  const atRisk = orgs.filter((o) => o.healthState === "COOLING" || o.healthState === "DORMANT").length;
  const lost = orgs.filter((o) => o.healthState === "LOST").length;

  return {
    series: monthsBetween(from, to).map((m) => ({
      label: m,
      month: m,
      value: users.filter((u) => monthKey(u.createdAt) === m).length,
    })),
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      isActive: u.isActive,
      createdAt: u.createdAt,
    })),
    byRole,
    byHealth,
    totals: {
      signups: users.length,
      active: users.filter((u) => u.isActive).length,
      accounts: orgs.length,
      atRisk,
      lost,
      churnRatePct: orgs.length > 0 ? Math.round((lost / orgs.length) * 100) : 0,
    },
    columns: ["id", "name", "email", "role", "isActive", "createdAt"],
  };
}

async function servicesReport(from: Date, to: Date) {
  const projects = await prisma.project.findMany({
    where: { createdAt: { gte: from, lte: to } },
    include: {
      service: { select: { id: true, name: true, categoryTier1: true, starterPrice: true } },
      engagement: { select: { id: true } },
    },
  });

  const byService = new Map<
    string,
    { name: string; category: string; sold: number; listPrice: number }
  >();
  for (const p of projects) {
    const row = byService.get(p.serviceId) ?? {
      name: p.service.name,
      category: p.service.categoryTier1,
      sold: 0,
      listPrice: p.service.starterPrice ?? 0,
    };
    row.sold += 1;
    byService.set(p.serviceId, row);
  }

  // Revenue is recognised per engagement, so attribute an engagement's invoiced
  // total across the services delivered under it.
  const engagementIds = [...new Set(projects.map((p) => p.engagementId))];
  const invoices = await prisma.invoice.findMany({
    where: { engagementId: { in: engagementIds }, status: { not: "CANCELLED" } },
    select: { engagementId: true, grandTotal: true },
  });
  const revenueByEngagement = new Map<string, number>();
  for (const inv of invoices) {
    if (!inv.engagementId) continue;
    revenueByEngagement.set(
      inv.engagementId,
      (revenueByEngagement.get(inv.engagementId) ?? 0) + inv.grandTotal,
    );
  }

  const projectsPerEngagement = new Map<string, number>();
  for (const p of projects) {
    projectsPerEngagement.set(p.engagementId, (projectsPerEngagement.get(p.engagementId) ?? 0) + 1);
  }

  const revenueByService = new Map<string, number>();
  for (const p of projects) {
    const engRevenue = revenueByEngagement.get(p.engagementId) ?? 0;
    const share = engRevenue / (projectsPerEngagement.get(p.engagementId) || 1);
    revenueByService.set(p.serviceId, (revenueByService.get(p.serviceId) ?? 0) + share);
  }

  const rows = [...byService.entries()]
    .map(([serviceId, r]) => ({
      serviceId,
      service: r.name,
      category: r.category,
      sold: r.sold,
      listPrice: rupees(r.listPrice),
      revenue: rupees(revenueByService.get(serviceId) ?? 0),
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const catalogueSize = await prisma.serviceUnit.count({ where: { status: "PUBLISHED" } });

  return {
    series: rows.slice(0, 10).map((r) => ({ label: r.service, value: r.sold })),
    services: rows,
    totals: {
      distinctServicesSold: rows.length,
      catalogueSize,
      // What share of the published catalogue actually sells.
      catalogueUtilisationPct:
        catalogueSize > 0 ? Math.round((rows.length / catalogueSize) * 100) : 0,
      unitsSold: rows.reduce((s, r) => s + r.sold, 0),
      revenue: rows.reduce((s, r) => s + r.revenue, 0),
      topService: rows[0]?.service ?? null,
    },
    columns: ["serviceId", "service", "category", "sold", "revenue"],
  };
}

const BUILDERS: Record<ReportType, (from: Date, to: Date) => Promise<any>> = {
  revenue: revenueReport,
  projects: projectsReport,
  users: usersReport,
  services: servicesReport,
};

/** Rows for the CSV export, per report type. */
function csvRows(type: ReportType, report: any): string[][] {
  const header = ["StackFox report", type];
  const meta = ["Generated", new Date().toISOString()];

  const totals = Object.entries(report.totals).map(([k, v]) => [k, String(v)]);

  const detail: string[][] = (() => {
    switch (type) {
      case "revenue":
        return [
          ["Month", "Invoiced (INR)", "Collected (INR)"],
          ...report.series.map((r: any) => [r.month, String(r.invoiced), String(r.collected)]),
          [],
          ["Client", "Invoices", "Revenue (INR)", "Share %"],
          ...report.clients.map((c: any) => [c.client, String(c.invoices), String(c.revenue), String(c.sharePct)]),
        ];
      case "projects":
        return [
          ["Project ID", "Project", "Client", "Service", "Status", "Completion %", "Late milestones"],
          ...report.projects.map((p: any) => [
            p.projectId, p.project, p.client, p.service, p.status, String(p.completionPct), String(p.late),
          ]),
        ];
      case "users":
        return [
          ["User ID", "Name", "Email", "Role", "Active", "Joined"],
          ...report.users.map((u: any) => [
            u.id, u.name, u.email, u.role, String(u.isActive), new Date(u.createdAt).toISOString().slice(0, 10),
          ]),
        ];
      case "services":
        return [
          ["Service ID", "Service", "Category", "Units sold", "Revenue (INR)"],
          ...report.services.map((s: any) => [
            s.serviceId, s.service, s.category, String(s.sold), String(s.revenue),
          ]),
        ];
    }
  })();

  return [header, meta, [], ["Summary"], ...totals, [], ...detail];
}

/** RFC 4180 quoting — names and emails routinely contain commas and quotes. */
function toCsv(rows: string[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const v = cell ?? "";
          return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
        })
        .join(","),
    )
    .join("\r\n");
}

export async function adminReportRoutes(app: FastifyInstance) {
  app.get("/admin/reports/:type", async (req, reply) => {
    if (!requireRole(req, reply, INTERNAL)) return;

    const { type } = req.params as { type: string };
    if (!TYPES.includes(type as ReportType)) {
      return reply.code(404).send({ message: `Unknown report "${type}". Available: ${TYPES.join(", ")}.` });
    }

    let from: Date;
    let to: Date;
    try {
      ({ from, to } = range(req.query as Record<string, string>));
    } catch {
      return reply.code(400).send({ message: "Invalid date range. Use from=YYYY-MM-DD&to=YYYY-MM-DD." });
    }

    const data = await BUILDERS[type as ReportType](from, to);
    return ok(data, { type, from: from.toISOString(), to: to.toISOString() });
  });

  /**
   * CSV export. Streams straight to the browser as a download rather than
   * being assembled client-side, so the file matches the report exactly.
   */
  app.get("/admin/reports/:type/export", async (req, reply) => {
    if (!requireRole(req, reply, INTERNAL)) return;

    const { type } = req.params as { type: string };
    if (!TYPES.includes(type as ReportType)) {
      return reply.code(404).send({ message: `Unknown report "${type}".` });
    }

    let from: Date;
    let to: Date;
    try {
      ({ from, to } = range(req.query as Record<string, string>));
    } catch {
      return reply.code(400).send({ message: "Invalid date range." });
    }

    const data = await BUILDERS[type as ReportType](from, to);
    const stamp = `${from.toISOString().slice(0, 10)}_${to.toISOString().slice(0, 10)}`;

    return reply
      .header("Content-Type", "text/csv; charset=utf-8")
      .header("Content-Disposition", `attachment; filename="stackfox-${type}-${stamp}.csv"`)
      .send(toCsv(csvRows(type as ReportType, data)));
  });
}
