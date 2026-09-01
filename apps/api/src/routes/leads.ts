import type { FastifyInstance } from "fastify";
import { prisma } from "@stackfox/prisma";
import { requireRole } from "../plugins/auth";
import { emitEvent } from "../lib/events";
import { queues } from "../lib/queue";
import { toJson } from "../lib/json";
import { ok, withId, withIds, paginated, pageParams } from "../lib/http";

/**
 * Sales CRM — leads, pipeline, follow-ups and proposals.
 *
 * The sales dashboard screens were built entirely on mock data with no backend;
 * this is that backend. Leads live in the same `leads` table as the public
 * intake (/lead/demo, /project-inquiries) — CRM-specific columns are null on
 * plain intake rows, and the `stage` column (not `status`) drives the pipeline.
 */

const SALES_ROLES = ["ADMIN", "SUPER_ADMIN", "SALES", "SENIOR_PM", "SE", "PM"];

const STAGES = [
  "new", "contacted", "interested", "meeting", "demo", "proposal",
  "negotiation", "won", "not-interested", "lost", "followup",
] as const;
const PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;
const CHANNELS = ["CALL", "WHATSAPP", "EMAIL", "MEETING", "DEMO"] as const;

/** Accepts "High" / "high" / "HIGH" etc.; anything unrecognised -> null. */
const norm = (v: unknown, allowed: readonly string[]): string | null => {
  if (typeof v !== "string") return null;
  const u = v.trim().toUpperCase();
  return allowed.includes(u) ? u : null;
};
/** The pipeline's human labels, so the client can send either the id or the label. */
const STAGE_LABELS: Record<string, string> = {
  "new-lead": "new", "new": "new",
  "contacted": "contacted",
  "interested": "interested",
  "meeting-scheduled": "meeting", "meeting": "meeting",
  "demo-completed": "demo", "demo": "demo",
  "proposal-sent": "proposal", "proposal": "proposal",
  "negotiation": "negotiation",
  "won": "won",
  "not-interested": "not-interested",
  "lost": "lost",
  "follow-up-later": "followup", "followup": "followup",
};
const toStage = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  return STAGE_LABELS[v.trim().toLowerCase().replace(/\s+/g, "-")] ?? null;
};

const leadInclude = {
  activities: { orderBy: { createdAt: "desc" as const }, take: 50 },
  followUps: { orderBy: { dueAt: "asc" as const } },
  proposals: { orderBy: { createdAt: "desc" as const } },
};

function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function leadRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (req, reply) => {
    if (!requireRole(req, reply, SALES_ROLES)) return;
  });

  // ── Leads ───────────────────────────────────────────────────────────────────
  app.get("/leads", async (req) => {
    const q = req.query as Record<string, string>;
    const { page, limit, skip } = pageParams(q, 50, 200);

    const where: any = {};
    if (q.stage && q.stage !== "all") where.stage = q.stage;
    if (q.priority && q.priority !== "all") where.priority = q.priority;
    if (q.assignedTo === "me") where.assignedTo = req.user!.sub;
    else if (q.assignedTo) where.assignedTo = q.assignedTo;
    if (q.source) where.source = q.source;
    // Only CRM-triaged leads by default; `?includeIntake=1` widens to raw intake.
    if (!q.includeIntake) where.stage = where.stage ?? { not: null };
    if (q.q) {
      where.OR = [
        { name: { contains: q.q, mode: "insensitive" } },
        { company: { contains: q.q, mode: "insensitive" } },
        { email: { contains: q.q, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.lead.findMany({ where, skip, take: limit, orderBy: { updatedAt: "desc" } }),
      prisma.lead.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  });

  app.get("/leads/stats", async (req) => {
    const mine = (req.query as Record<string, string>).mine === "1";
    const base: any = mine ? { assignedTo: req.user!.sub } : {};
    const crm = { ...base, stage: { not: null } };

    const [byStage, monthWon, target, followUpsToday] = await Promise.all([
      prisma.lead.groupBy({ by: ["stage"], where: crm, _count: true, _sum: { value: true } }),
      prisma.lead.aggregate({
        where: { ...crm, stage: "won", updatedAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } },
        _sum: { value: true },
        _count: true,
      }),
      prisma.rateCard.findFirst({ where: { type: "SALES_TARGET" }, orderBy: { effectiveFrom: "desc" } }),
      prisma.followUp.count({
        where: {
          status: "PENDING",
          dueAt: { lt: new Date(new Date().setHours(23, 59, 59, 999)) },
          ...(mine ? { assignedTo: req.user!.sub } : {}),
        },
      }),
    ]);

    const stageMap = Object.fromEntries(
      byStage.map((s) => [s.stage ?? "unknown", { count: s._count, value: s._sum.value ?? 0 }]),
    );
    const totalLeads = byStage.reduce((n, s) => n + s._count, 0);
    const won = stageMap["won"]?.count ?? 0;
    const lost = (stageMap["lost"]?.count ?? 0) + (stageMap["not-interested"]?.count ?? 0);
    const closed = won + lost;

    return ok({
      period: currentMonthKey(),
      totalLeads,
      newLeads: stageMap["new"]?.count ?? 0,
      inProgress: totalLeads - won - lost,
      won,
      lost,
      conversionRate: closed ? Math.round((won / closed) * 100) : 0,
      monthlyValueWon: monthWon._sum.value ?? 0,
      monthlyTarget: target?.rate ?? 0,
      followUpsToday,
      byStage: stageMap,
    });
  });

  app.get("/leads/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const lead = await prisma.lead.findUnique({ where: { id }, include: leadInclude });
    if (!lead) return reply.code(404).send({ message: "Lead not found" });
    return ok(withId(lead));
  });

  app.post("/leads", async (req, reply) => {
    const b = req.body as Record<string, any>;
    const name = (b.ownerName || b.name || "").trim();
    const company = (b.company || b.businessName || "").trim();
    if (!name && !company) {
      return reply.code(400).send({ message: "A contact name or company is required" });
    }
    const priority = norm(b.priority, PRIORITIES) ?? "MEDIUM";
    const stage = toStage(b.stage) ?? "new";

    const lead = await prisma.lead.create({
      data: {
        name: name || company,
        ownerName: b.ownerName ?? null,
        company: company || null,
        email: (b.email ?? "").trim(),
        phone: (b.phone || b.contact) ?? null,
        category: b.category ?? null,
        location: b.location ?? null,
        website: b.website ?? null,
        priority,
        value: Number.isFinite(+b.value) ? Math.round(+b.value) : 0,
        stage,
        source: b.source ?? "sales",
        assignedTo: b.assignedTo ?? req.user!.sub,
        message: b.notes ?? b.message ?? null,
      },
    });

    if (b.notes) {
      await prisma.leadActivity.create({
        data: { leadId: lead.id, type: "NOTE", body: b.notes, actorId: req.user!.sub },
      });
    }
    await emitEvent({ code: "LEAD_CREATED", payload: { leadId: lead.id, source: lead.source }, actor: req.user!.sub });
    return ok(withId(lead));
  });

  app.patch("/leads/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const b = req.body as Record<string, any>;
    const data: any = {};
    for (const f of ["ownerName", "company", "email", "category", "location", "website"] as const) {
      if (typeof b[f] === "string") data[f] = b[f].trim() || null;
    }
    if (typeof b.contact === "string") data.phone = b.contact.trim() || null;
    if (typeof b.phone === "string") data.phone = b.phone.trim() || null;
    if (norm(b.priority, PRIORITIES)) data.priority = norm(b.priority, PRIORITIES);
    if (b.value !== undefined && Number.isFinite(+b.value)) data.value = Math.round(+b.value);
    if (typeof b.assignedTo === "string") data.assignedTo = b.assignedTo;

    if (Object.keys(data).length === 0) {
      return reply.code(400).send({ message: "No updatable fields supplied" });
    }
    const lead = await prisma.lead.update({ where: { id }, data });
    return ok(withId(lead));
  });

  app.patch("/leads/:id/stage", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { stage } = req.body as { stage?: string };
    const st = toStage(stage);
    if (!st) {
      return reply.code(400).send({ message: `stage must be one of: ${STAGES.join(", ")}` });
    }
    const before = await prisma.lead.findUnique({ where: { id } });
    if (!before) return reply.code(404).send({ message: "Lead not found" });
    if (before.stage === st) return ok(withId(before));

    // Keep the intake `status` roughly in step so cross-surface reporting agrees.
    const status =
      st === "won" ? "CONVERTED" : st === "lost" || st === "not-interested" ? "LOST"
        : st === "new" ? "NEW" : "CONTACTED";

    const lead = await prisma.lead.update({
      where: { id },
      data: { stage: st, status, lastContactedAt: new Date() },
    });
    await prisma.leadActivity.create({
      data: {
        leadId: id,
        type: "STAGE_CHANGE",
        body: `${before.stage ?? "untriaged"} → ${st}`,
        actorId: req.user!.sub,
      },
    });
    await emitEvent({
      code: "LEAD_STAGE_CHANGED",
      payload: { leadId: id, from: before.stage, to: st },
      actor: req.user!.sub,
    });
    return ok(withId(lead));
  });

  app.post("/leads/:id/notes", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { body, type } = req.body as { body?: string; type?: string };
    if (!body?.trim()) return reply.code(400).send({ message: "A note body is required" });
    const kind = ["NOTE", "CALL", "EMAIL", "MEETING"].includes(type ?? "") ? type! : "NOTE";

    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) return reply.code(404).send({ message: "Lead not found" });

    const activity = await prisma.leadActivity.create({
      data: { leadId: id, type: kind, body: body.trim(), actorId: req.user!.sub },
    });
    await prisma.lead.update({ where: { id }, data: { lastContactedAt: new Date() } });
    return ok(withId(activity));
  });

  // ── Follow-ups ──────────────────────────────────────────────────────────────
  app.get("/followups", async (req) => {
    const q = req.query as Record<string, string>;
    const where: any = { status: q.status ?? "PENDING" };
    if (q.mine === "1") where.assignedTo = req.user!.sub;

    const now = new Date();
    const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999);
    if (q.due === "overdue") {
      where.dueAt = { lt: now };
    } else if (q.due === "today") {
      where.dueAt = { gte: now, lte: endOfToday };
    } else if (q.due === "upcoming") {
      where.dueAt = { gt: endOfToday };
    }

    const items = await prisma.followUp.findMany({
      where,
      orderBy: { dueAt: "asc" },
      take: 200,
      include: { lead: { select: { id: true, name: true, company: true, category: true, phone: true, email: true } } },
    });
    return ok(withIds(items));
  });

  app.post("/leads/:id/followups", async (req, reply) => {
    const { id } = req.params as { id: string };
    const b = req.body as Record<string, any>;
    if (!b.dueAt) return reply.code(400).send({ message: "dueAt is required" });
    const channel = norm(b.channel, CHANNELS) ?? "CALL";

    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) return reply.code(404).send({ message: "Lead not found" });

    const followUp = await prisma.followUp.create({
      data: {
        leadId: id,
        dueAt: new Date(b.dueAt),
        channel,
        note: b.note ?? null,
        assignedTo: b.assignedTo ?? lead.assignedTo ?? req.user!.sub,
      },
    });
    await prisma.leadActivity.create({
      data: { leadId: id, type: "FOLLOWUP", body: `Scheduled ${channel.toLowerCase()} for ${followUp.dueAt.toISOString().slice(0, 16).replace("T", " ")}`, actorId: req.user!.sub },
    });
    return ok(withId(followUp));
  });

  app.patch("/followups/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { status, note, dueAt } = req.body as { status?: string; note?: string; dueAt?: string };
    const data: any = {};
    if (["PENDING", "DONE", "SKIPPED"].includes(status ?? "")) {
      data.status = status;
      data.completedAt = status === "PENDING" ? null : new Date();
    }
    if (typeof note === "string") data.note = note;
    if (dueAt) data.dueAt = new Date(dueAt);
    if (Object.keys(data).length === 0) return reply.code(400).send({ message: "Nothing to update" });

    const followUp = await prisma.followUp.update({ where: { id }, data });
    if (data.status === "DONE") {
      await prisma.leadActivity.create({
        data: { leadId: followUp.leadId, type: "FOLLOWUP", body: "Follow-up completed", actorId: req.user!.sub },
      });
      await prisma.lead.update({ where: { id: followUp.leadId }, data: { lastContactedAt: new Date() } });
    }
    return ok(withId(followUp));
  });

  // ── Proposals ───────────────────────────────────────────────────────────────
  app.post("/leads/:id/proposals", async (req, reply) => {
    const { id } = req.params as { id: string };
    const b = req.body as Record<string, any>;
    if (!b.title?.trim()) return reply.code(400).send({ message: "A proposal title is required" });

    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) return reply.code(404).send({ message: "Lead not found" });

    const proposal = await prisma.proposal.create({
      data: {
        leadId: id,
        title: b.title.trim(),
        packages: toJson(b.packages ?? {}),
        notes: b.notes ?? null,
        totalMin: Number.isFinite(+b.totalMin) ? Math.round(+b.totalMin) : 0,
        totalMax: Number.isFinite(+b.totalMax) ? Math.round(+b.totalMax) : 0,
        createdBy: req.user!.sub,
      },
    });
    return ok(withId(proposal));
  });

  app.patch("/proposals/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const b = req.body as Record<string, any>;
    const data: any = {};
    if (typeof b.title === "string" && b.title.trim()) data.title = b.title.trim();
    if (b.packages !== undefined) data.packages = toJson(b.packages);
    if (typeof b.notes === "string") data.notes = b.notes;
    if (b.totalMin !== undefined && Number.isFinite(+b.totalMin)) data.totalMin = Math.round(+b.totalMin);
    if (b.totalMax !== undefined && Number.isFinite(+b.totalMax)) data.totalMax = Math.round(+b.totalMax);
    if (["DRAFT", "SENT", "ACCEPTED", "REJECTED"].includes(b.status ?? "")) data.status = b.status;
    if (Object.keys(data).length === 0) return reply.code(400).send({ message: "Nothing to update" });

    const proposal = await prisma.proposal.update({ where: { id }, data });
    return ok(withId(proposal));
  });

  app.post("/proposals/:id/send", async (req, reply) => {
    const { id } = req.params as { id: string };
    const proposal = await prisma.proposal.update({
      where: { id },
      data: { status: "SENT", sentAt: new Date() },
    });
    await prisma.leadActivity.create({
      data: { leadId: proposal.leadId, type: "PROPOSAL", body: `Proposal "${proposal.title}" sent`, actorId: req.user!.sub },
    });
    // Nudge the lead into the proposal stage if it is behind.
    await prisma.lead.updateMany({
      where: { id: proposal.leadId, stage: { in: ["new", "contacted", "interested", "meeting", "demo"] } },
      data: { stage: "proposal", status: "CONTACTED" },
    });
    await queues.docGen.add("proposal", { type: "proposal", proposalId: id }).catch((err) => {
      req.log.warn({ err: err.message }, "proposal PDF enqueue failed");
    });
    await emitEvent({ code: "PROPOSAL_SENT", payload: { proposalId: id, leadId: proposal.leadId }, actor: req.user!.sub });
    return ok(withId(proposal));
  });
}
