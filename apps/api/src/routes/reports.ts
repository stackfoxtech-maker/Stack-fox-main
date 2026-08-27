import type { FastifyInstance } from "fastify";
import { prisma } from "@stackfox/prisma";
import { clientScope } from "../lib/scope";
import { ok } from "../lib/http";
import { uploadFile, getPresignedDownload, isStorageConfigured } from "../lib/storage";
import { SLA_TARGETS } from "@stackfox/core";

/**
 * Client reporting.
 *
 * The portal previously POSTed to `/reports/generate`, which did not exist, and
 * rendered "[ chart placeholder ]" — it reported success on a 404. Every figure
 * below is computed from the caller's own rows.
 *
 * Money is stored in paise throughout the schema; everything returned here is
 * converted to rupees, because that is what the display layer formats.
 */

const REPORT_TYPES = ["spend", "timeline", "revisions", "engagement"] as const;
type ReportType = (typeof REPORT_TYPES)[number];

const paise = (n: number) => Math.round(n) / 100;

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * `Milestone.dueDate` is a date-only column, so it materialises at 00:00 UTC.
 * Comparing a full `approvedAt` timestamp against it directly marks anything
 * approved during the due day itself as late — the deadline is the *end* of
 * that day, not its first instant.
 */
function endOfDueDay(d: Date): Date {
  return new Date(d.getTime() + 86400000 - 1);
}

/** Last `n` months as YYYY-MM, oldest first, so a chart has no gaps. */
function recentMonths(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    out.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  }
  return out;
}

async function engagementIdsFor(scope: string | null): Promise<string[] | null> {
  if (scope === null) return null;
  const rows = await prisma.engagement.findMany({
    where: { clientId: scope },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

// ── Report builders ─────────────────────────────────────────────────────────

/** Invoiced vs paid per month, plus outstanding balance. */
async function spendReport(scope: string | null) {
  const where = scope !== null ? { orgId: scope } : {};
  const invoices = await prisma.invoice.findMany({
    where: { ...where, status: { not: "CANCELLED" } },
    select: { grandTotal: true, status: true, createdAt: true, paidAt: true, dueDate: true },
  });

  const months = recentMonths(6);
  const byMonth = new Map(months.map((m) => [m, { invoiced: 0, paid: 0 }]));

  for (const inv of invoices) {
    const bucket = byMonth.get(monthKey(inv.createdAt));
    if (bucket) bucket.invoiced += inv.grandTotal;
    if (inv.paidAt) {
      const paidBucket = byMonth.get(monthKey(inv.paidAt));
      if (paidBucket) paidBucket.paid += inv.grandTotal;
    }
  }

  const totalInvoiced = invoices.reduce((s, i) => s + i.grandTotal, 0);
  const totalPaid = invoices
    .filter((i) => i.status === "PAID")
    .reduce((s, i) => s + i.grandTotal, 0);

  const now = new Date();
  const overdue = invoices.filter(
    (i) => i.status !== "PAID" && i.dueDate && i.dueDate < now,
  );

  return {
    series: months.map((m) => ({
      label: m,
      month: m,
      invoiced: paise(byMonth.get(m)!.invoiced),
      paid: paise(byMonth.get(m)!.paid),
      value: paise(byMonth.get(m)!.invoiced),
    })),
    totals: {
      invoiced: paise(totalInvoiced),
      paid: paise(totalPaid),
      outstanding: paise(totalInvoiced - totalPaid),
      overdueCount: overdue.length,
      overdueAmount: paise(overdue.reduce((s, i) => s + i.grandTotal, 0)),
      invoiceCount: invoices.length,
    },
  };
}

/** Milestone delivery against committed dates. */
async function timelineReport(scope: string | null) {
  const engIds = await engagementIdsFor(scope);

  const projects = await prisma.project.findMany({
    where: engIds ? { engagementId: { in: engIds } } : {},
    include: { milestones: { orderBy: { number: "asc" } } },
  });

  const rows = projects.map((p) => {
    const total = p.milestones.length;
    const approved = p.milestones.filter((m) => m.status === "APPROVED").length;

    // "Late" means it has a due date in the past and is not yet approved.
    const now = new Date();
    const late = p.milestones.filter(
      (m) => m.status !== "APPROVED" && m.dueDate && endOfDueDay(m.dueDate) < now,
    );

    // Only approved milestones with a due date can be scored for punctuality.
    const scored = p.milestones.filter((m) => m.status === "APPROVED" && m.dueDate && m.approvedAt);
    const onTime = scored.filter((m) => m.approvedAt! <= endOfDueDay(m.dueDate!)).length;

    return {
      projectId: p.id,
      project: p.name || p.id,
      status: p.status,
      totalMilestones: total,
      approved,
      progressPct: total > 0 ? Math.round((approved / total) * 100) : 0,
      lateCount: late.length,
      onTimePct: scored.length > 0 ? Math.round((onTime / scored.length) * 100) : null,
      nextDue: p.milestones.find((m) => m.status !== "APPROVED" && m.dueDate)?.dueDate ?? null,
    };
  });

  const scoredRows = rows.filter((r) => r.onTimePct !== null);

  return {
    series: rows.map((r) => ({ label: r.project, value: r.progressPct })),
    projects: rows,
    totals: {
      projects: rows.length,
      milestones: rows.reduce((s, r) => s + r.totalMilestones, 0),
      approved: rows.reduce((s, r) => s + r.approved, 0),
      late: rows.reduce((s, r) => s + r.lateCount, 0),
      onTimePct:
        scoredRows.length > 0
          ? Math.round(scoredRows.reduce((s, r) => s + r.onTimePct!, 0) / scoredRows.length)
          : null,
    },
  };
}

/** Revision rounds consumed, and defects raised, per project. */
async function revisionsReport(scope: string | null) {
  const engIds = await engagementIdsFor(scope);

  const projects = await prisma.project.findMany({
    where: engIds ? { engagementId: { in: engIds } } : {},
    include: {
      milestones: true,
      tickets: { select: { severity: true, status: true, category: true } },
      changeRequests: { select: { status: true, costDelta: true } },
    },
  });

  const rows = projects.map((p) => {
    const roundsUsed = p.milestones.reduce((s, m) => s + m.feedbackRound, 0);
    const roundsIncluded = p.milestones.reduce((s, m) => s + m.maxRounds, 0);
    const bugs = p.tickets.filter((t) => t.category === "bug");

    return {
      projectId: p.id,
      project: p.name || p.id,
      roundsUsed,
      roundsIncluded,
      // Above 100% means revisions spilled into billable change requests.
      roundsUtilisationPct: roundsIncluded > 0 ? Math.round((roundsUsed / roundsIncluded) * 100) : 0,
      bugsRaised: bugs.length,
      bugsOpen: bugs.filter((t) => !["RESOLVED", "VERIFIED", "CLOSED"].includes(t.status)).length,
      severityMix: {
        P1: bugs.filter((t) => t.severity === "P1").length,
        P2: bugs.filter((t) => t.severity === "P2").length,
        P3: bugs.filter((t) => t.severity === "P3").length,
        P4: bugs.filter((t) => t.severity === "P4").length,
      },
      changeRequests: p.changeRequests.length,
      changeRequestValue: paise(
        p.changeRequests
          .filter((c) => c.status === "APPROVED")
          .reduce((s, c) => s + (c.costDelta ?? 0), 0),
      ),
    };
  });

  return {
    series: rows.map((r) => ({ label: r.project, value: r.roundsUsed })),
    projects: rows,
    totals: {
      roundsUsed: rows.reduce((s, r) => s + r.roundsUsed, 0),
      roundsIncluded: rows.reduce((s, r) => s + r.roundsIncluded, 0),
      bugsRaised: rows.reduce((s, r) => s + r.bugsRaised, 0),
      bugsOpen: rows.reduce((s, r) => s + r.bugsOpen, 0),
      changeRequests: rows.reduce((s, r) => s + r.changeRequests, 0),
    },
  };
}

/** Support responsiveness and satisfaction. */
async function engagementReport(scope: string | null) {
  const engIds = await engagementIdsFor(scope);
  const projectIds = engIds
    ? (
        await prisma.project.findMany({
          where: { engagementId: { in: engIds } },
          select: { id: true },
        })
      ).map((p) => p.id)
    : null;

  const tickets = await prisma.ticket.findMany({
    where: projectIds ? { projectId: { in: projectIds } } : {},
    select: {
      severity: true,
      status: true,
      createdAt: true,
      acknowledgedAt: true,
      resolvedAt: true,
    },
  });

  const acknowledged = tickets.filter((t) => t.acknowledgedAt);
  const resolved = tickets.filter((t) => t.resolvedAt);

  const avgMinutes = (rows: Array<{ createdAt: Date; at: Date }>) =>
    rows.length === 0
      ? null
      : Math.round(
          rows.reduce((s, r) => s + (r.at.getTime() - r.createdAt.getTime()) / 60000, 0) / rows.length,
        );

  const avgResponse = avgMinutes(
    acknowledged.map((t) => ({ createdAt: t.createdAt, at: t.acknowledgedAt! })),
  );
  const avgResolution = avgMinutes(
    resolved.map((t) => ({ createdAt: t.createdAt, at: t.resolvedAt! })),
  );

  // Measured against the target for each ticket's own severity.
  const withinResponse = acknowledged.filter((t) => {
    const target = SLA_TARGETS[(t.severity as keyof typeof SLA_TARGETS) ?? "P3"];
    if (!target) return true;
    return (t.acknowledgedAt!.getTime() - t.createdAt.getTime()) / 60000 <= target.responseMin;
  }).length;

  const feedback = await prisma.feedback.findMany({
    where: scope !== null ? { orgId: scope } : {},
    select: { rating: true, nps: true, createdAt: true },
  });

  const promoters = feedback.filter((f) => f.nps >= 9).length;
  const detractors = feedback.filter((f) => f.nps > 0 && f.nps <= 6).length;
  const rated = feedback.filter((f) => f.nps > 0).length;

  return {
    series: recentMonths(6).map((m) => ({
      label: m,
      month: m,
      value: tickets.filter((t) => monthKey(t.createdAt) === m).length,
    })),
    totals: {
      tickets: tickets.length,
      open: tickets.filter((t) => !["RESOLVED", "VERIFIED", "CLOSED"].includes(t.status)).length,
      avgResponseMinutes: avgResponse,
      avgResolutionMinutes: avgResolution,
      slaMetPct:
        acknowledged.length > 0 ? Math.round((withinResponse / acknowledged.length) * 100) : null,
      avgRating:
        feedback.length > 0
          ? Math.round((feedback.reduce((s, f) => s + f.rating, 0) / feedback.length) * 10) / 10
          : null,
      // Standard NPS: %promoters - %detractors, over respondents who scored.
      nps: rated > 0 ? Math.round(((promoters - detractors) / rated) * 100) : null,
      responses: feedback.length,
    },
  };
}

const BUILDERS: Record<ReportType, (scope: string | null) => Promise<unknown>> = {
  spend: spendReport,
  timeline: timelineReport,
  revisions: revisionsReport,
  engagement: engagementReport,
};

// ── Routes ──────────────────────────────────────────────────────────────────

export async function reportRoutes(app: FastifyInstance) {
  /** All four reports in one round trip — what the Reports page loads with. */
  app.get("/reports/summary", async (req, reply) => {
    const scope = await clientScope(req, reply);
    if (scope === undefined) return;

    const [spend, timeline, revisions, engagement] = await Promise.all([
      spendReport(scope),
      timelineReport(scope),
      revisionsReport(scope),
      engagementReport(scope),
    ]);

    return ok({ spend, timeline, revisions, engagement }, { generatedAt: new Date().toISOString() });
  });

  app.get("/reports/:type", async (req, reply) => {
    const scope = await clientScope(req, reply);
    if (scope === undefined) return;

    const { type } = req.params as { type: string };
    if (!REPORT_TYPES.includes(type as ReportType)) {
      return reply.code(404).send({
        message: `Unknown report "${type}". Available: ${REPORT_TYPES.join(", ")}.`,
      });
    }

    const data = await BUILDERS[type as ReportType](scope);
    return ok(data, { type, generatedAt: new Date().toISOString() });
  });

  /**
   * Renders a report to a stored JSON artefact and hands back a signed URL, so
   * "Generate report" produces something the client can actually keep or send
   * on, rather than a toast.
   */
  app.post("/reports/generate", async (req, reply) => {
    const scope = await clientScope(req, reply);
    if (scope === undefined) return;

    const { type } = req.body as { type?: string };
    if (!type || !REPORT_TYPES.includes(type as ReportType)) {
      return reply.code(400).send({
        message: `A report type is required. Available: ${REPORT_TYPES.join(", ")}.`,
      });
    }

    const data = await BUILDERS[type as ReportType](scope);
    const generatedAt = new Date();
    const document = {
      type,
      orgId: scope,
      generatedAt: generatedAt.toISOString(),
      generatedBy: req.user!.sub,
      data,
    };

    if (!isStorageConfigured()) {
      // Still return the payload — the page can render it even if we cannot
      // persist a downloadable copy.
      return ok({ ...document, downloadUrl: null }, {
        warning: "Report storage is not configured; download is unavailable.",
      });
    }

    const key = `reports/${scope ?? "internal"}/${type}-${generatedAt.getTime()}.json`;
    await uploadFile(key, Buffer.from(JSON.stringify(document, null, 2)), "application/json");
    const downloadUrl = await getPresignedDownload(key, 3600);

    return ok({ ...document, key, downloadUrl });
  });
}
