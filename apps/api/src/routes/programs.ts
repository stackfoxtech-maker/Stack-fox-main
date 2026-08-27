import type { FastifyInstance } from "fastify";
import { prisma } from "@stackfox/prisma";
import { requireAuth } from "../plugins/auth";
import { emitEvent } from "../lib/events";
import * as ids from "../lib/id";
import { computeHealthState } from "@stackfox/core";
import type { FastifyRequest, FastifyReply } from "fastify";
import { requireRole } from "../plugins/auth";
import { clientScope } from "../lib/scope";
import { toJson } from "../lib/json";

/**
 * A programme groups engagements for one client, so it is readable by that
 * client and by internal staff — and by nobody else. These routes were fully
 * open, exposing budgets and delivery health across every account.
 */
async function programInScope(req: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  const scope = await clientScope(req, reply);
  if (scope === undefined) return false;
  if (scope === null) return true;

  const { id } = req.params as { id: string };
  const program = await prisma.program.findFirst({
    where: { id, clientId: scope },
    select: { id: true },
  });
  if (!program) {
    reply.code(404).send({ error: "Program not found" });
    return false;
  }
  return true;
}

export async function programRoutes(app: FastifyInstance) {
  app.post("/programs", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const body = req.body as any;
    return prisma.program.create({
      data: {
        id: ids.programId(),
        name: body.name,
        clientId: body.orgId ?? body.clientId,
        leadUserId: req.user!.sub,
        budgetEnvelope: body.budgetEnvelope ?? null,
      },
    });
  });

  app.get("/programs/:id", async (req, reply) => {
    if (!(await programInScope(req, reply))) return;
    const { id } = req.params as { id: string };
    const program = await prisma.program.findUnique({
      where: { id },
      include: { stakeholders: true },
    });
    if (!program) return reply.code(404).send({ error: "Program not found" });
    return program;
  });

  app.patch("/programs/:id", async (req, reply) => {
    // Programme structure is managed by StackFox, not the client.
    if (!requireRole(req, reply, ["ADMIN", "SUPER_ADMIN", "SENIOR_PM", "PM"])) return;
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as Record<string, unknown>;

    const data: Record<string, unknown> = {};
    if (typeof body.name === "string") data.name = body.name;
    if (typeof body.leadUserId === "string") data.leadUserId = body.leadUserId;
    if (typeof body.budgetEnvelope === "number") data.budgetEnvelope = body.budgetEnvelope;
    if (body.raid !== undefined) data.raid = toJson(body.raid);

    if (Object.keys(data).length === 0) {
      return reply.code(400).send({ error: "No updatable fields were supplied." });
    }
    return prisma.program.update({ where: { id }, data });
  });

  app.get("/programs/:id/engagements", async (req, reply) => {
    if (!(await programInScope(req, reply))) return;
    const { id } = req.params as { id: string };
    return prisma.engagement.findMany({
      where: { programId: id },
      include: { projects: true },
    });
  });

  app.get("/programs/:id/gantt", async (req, reply) => {
    if (!(await programInScope(req, reply))) return;
    const { id } = req.params as { id: string };
    const engagements = await prisma.engagement.findMany({
      where: { programId: id },
      include: { projects: { include: { milestones: { orderBy: { number: "asc" } } } } },
    });
    return engagements.flatMap((eng) =>
      eng.projects.map((p) => ({
        projectId: p.id,
        name: p.name,
        status: p.status,
        milestones: p.milestones.map((m) => ({
          number: m.number,
          name: m.name,
          status: m.status,
          dueDate: m.dueDate,
        })),
      }))
    );
  });

  app.post("/programs/:id/qbr", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { id } = req.params as { id: string };
    const engagements = await prisma.engagement.findMany({
      where: { programId: id },
      include: { projects: true, invoices: true },
    });

    const summary = {
      programId: id,
      totalEngagements: engagements.length,
      totalProjects: engagements.reduce((s, e) => s + e.projects.length, 0),
      totalInvoiced: engagements.reduce(
        (s, e) => s + e.invoices.reduce((si, inv) => si + (inv.grandTotal ?? 0), 0),
        0
      ),
      generatedAt: new Date().toISOString(),
    };

    await emitEvent({
      code: "QBR_GENERATED",
      payload: summary,
      actor: req.user!.sub,
    });

    return summary;
  });

  app.get("/programs/:id/health", async (req, reply) => {
    if (!(await programInScope(req, reply))) return;
    const { id } = req.params as { id: string };
    const engagements = await prisma.engagement.findMany({
      where: { programId: id },
      include: { projects: true, invoices: true },
    });

    const activeProjects = engagements.flatMap((e) => e.projects).filter((p) => p.status === "ACTIVE");
    const totalInvoiced = engagements.reduce(
      (s, e) => s + e.invoices.reduce((si, inv) => si + (inv.grandTotal ?? 0), 0),
      0
    );

    // "Last order" for a program is the most recent engagement start; a program
    // with no engagements at all is treated as brand new, not as stale.
    const lastActivity = engagements.reduce<Date | null>(
      (latest, e) => (!latest || e.createdAt > latest ? e.createdAt : latest),
      null,
    );
    const daysSinceLastOrder = lastActivity
      ? Math.floor((Date.now() - lastActivity.getTime()) / 86400000)
      : 0;

    const openTickets = await prisma.ticket.count({
      where: {
        projectId: { in: engagements.flatMap((e) => e.projects.map((p) => p.id)) },
        status: { notIn: ["RESOLVED", "VERIFIED", "CLOSED"] },
      },
    });

    const health = computeHealthState({
      daysSinceLastOrder,
      outstandingInvoices: engagements.reduce(
        (n, e) => n + e.invoices.filter((i) => i.status !== "PAID" && i.status !== "CANCELLED").length,
        0,
      ),
      openTickets,
    });

    return {
      programId: id,
      health,
      activeProjects: activeProjects.length,
      openTickets,
      daysSinceLastOrder,
      totalRevenue: totalInvoiced,
    };
  });
}
