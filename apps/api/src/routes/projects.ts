import type { FastifyInstance } from "fastify";
import { prisma } from "@stackfox/prisma";
import { requireAuth } from "../plugins/auth";
import { emitEvent } from "../lib/events";
import { queues } from "../lib/queue";
import * as ids from "../lib/id";
import { canTransition, PROJECT_TRANSITIONS } from "@stackfox/core";
import { clientScope, clientWriteScope, assertProjectInScope } from "../lib/scope";
import { paginated, pageParams } from "../lib/http";

export async function projectRoutes(app: FastifyInstance) {
  // GET /projects
  app.get("/projects", async (req, reply) => {
    const scope = await clientScope(req, reply);
    if (scope === undefined) return;

    const { engId, status, page = "1", limit = "20" } = req.query as Record<string, string>;
    const where: any = {};
    if (scope !== null) where.engagement = { clientId: scope };
    if (engId) where.engagementId = engId;
    if (status) where.status = status;

    const { page: p, limit: l, skip } = pageParams({ page, limit });
    const [items, total] = await Promise.all([
      prisma.project.findMany({
        where,
        include: { milestones: { orderBy: { number: "asc" } }, service: true },
        skip,
        take: l,
        orderBy: { createdAt: "desc" },
      }),
      prisma.project.count({ where }),
    ]);
    return paginated(items, total, p, l);
  });

  // GET /projects/:id
  app.get("/projects/:id", async (req, reply) => {
    const scope = await clientScope(req, reply);
    if (scope === undefined) return;

    const { id } = req.params as { id: string };
    if (!(await assertProjectInScope(id, scope, reply))) return;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        milestones: { orderBy: { number: "asc" } },
        service: true,
        engagement: true,
        changeRequests: { orderBy: { createdAt: "desc" } },
        tickets: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!project) return reply.code(404).send({ error: "Project not found" });
    return { data: { project: { ...project, _id: project.id } } };
  });

  // PATCH /projects/:id/status
  app.patch("/projects/:id/status", async (req, reply) => {
    const scope = await clientWriteScope(req, reply);
    if (scope === undefined) return;
    const { id } = req.params as { id: string };
    if (!(await assertProjectInScope(id, scope, reply))) return;
    const { status } = req.body as { status: string };

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) return reply.code(404).send({ error: "Project not found" });

    if (!canTransition(project.status as any, status as any, PROJECT_TRANSITIONS)) {
      return reply.code(409).send({ error: `Cannot transition from ${project.status} to ${status}` });
    }

    const updated = await prisma.project.update({ where: { id }, data: { status } });

    const codeMap: Record<string, string> = {
      ACTIVE: "PROJECT_KICKED_OFF",
      ON_HOLD: "PROJECT_PAUSED",
      COMPLETED: "PROJECT_COMPLETED",
      CANCELLED: "PROJECT_CANCELLED",
    };
    if (codeMap[status]) {
      await emitEvent({ code: codeMap[status], payload: { projectId: id }, actor: req.user!.sub, projectId: id });
    }

    return updated;
  });

  // GET /projects/:id/milestones
  app.get("/projects/:id/milestones", async (req, reply) => {
    const scope = await clientScope(req, reply);
    if (scope === undefined) return;

    const { id } = req.params as { id: string };
    if (!(await assertProjectInScope(id, scope, reply))) return;

    const milestones = await prisma.milestone.findMany({ where: { projectId: id }, orderBy: { number: "asc" } });
    return { data: milestones };
  });

  // PATCH /projects/:id/milestones/:n/approve
  app.patch("/projects/:id/milestones/:n/approve", async (req, reply) => {
    const scope = await clientWriteScope(req, reply);
    if (scope === undefined) return;
    const { id, n } = req.params as { id: string; n: string };
    if (!(await assertProjectInScope(id, scope, reply))) return;

    const milestone = await prisma.milestone.findUnique({
      where: { projectId_number: { projectId: id, number: parseInt(n) } },
    });
    if (!milestone) return reply.code(404).send({ error: "Milestone not found" });
    if (milestone.status !== "IN_REVIEW") {
      return reply.code(409).send({ error: "Milestone must be IN_REVIEW to approve" });
    }

    const updated = await prisma.milestone.update({
      where: { id: milestone.id },
      data: { status: "APPROVED", approvedAt: new Date() },
    });

    await emitEvent({
      code: "MILESTONE_APPROVED",
      payload: { projectId: id, milestone: parseInt(n) },
      actor: req.user!.sub,
      projectId: id,
    });

    // Trigger invoice for this milestone
    const project = await prisma.project.findUnique({
      where: { id },
      include: { engagement: true },
    });
    if (project) {
      await queues.docGen.add("milestone-invoice", {
        type: "milestone-invoice",
        projectId: id,
        milestoneNumber: parseInt(n),
        engagementId: project.engagementId,
      });
    }

    return updated;
  });

  // PATCH /projects/:id/milestones/:n/request-revision
  app.patch("/projects/:id/milestones/:n/request-revision", async (req, reply) => {
    const scope = await clientWriteScope(req, reply);
    if (scope === undefined) return;
    const { id, n } = req.params as { id: string; n: string };
    if (!(await assertProjectInScope(id, scope, reply))) return;
    const { feedback } = req.body as { feedback: string };

    const milestone = await prisma.milestone.findUnique({
      where: { projectId_number: { projectId: id, number: parseInt(n) } },
    });
    if (!milestone) return reply.code(404).send({ error: "Milestone not found" });

    const newRound = milestone.feedbackRound + 1;

    // If exceeding max rounds, auto-generate CR
    if (newRound > milestone.maxRounds) {
      const cr = await prisma.changeRequest.create({
        data: {
          id: ids.crId(),
          projectId: id,
          title: `Extra revision round ${newRound} for Milestone ${n}`,
          description: feedback,
          urgency: "LOW",
          affectedMilestones: [parseInt(n)],
          status: "SUBMITTED",
          raisedBy: req.user!.sub,
        },
      });

      await emitEvent({
        code: "CR_SUBMITTED",
        payload: { crId: cr.id, reason: "extra_revision" },
        actor: req.user!.sub,
        projectId: id,
      });

      return { milestone, cr, message: "Revision exceeds included rounds. Change request created." };
    }

    const updated = await prisma.milestone.update({
      where: { id: milestone.id },
      data: { status: "REVISION", feedbackRound: newRound },
    });

    await emitEvent({
      code: "MILESTONE_REVISION_REQUESTED",
      payload: { projectId: id, milestone: parseInt(n), round: newRound, feedback },
      actor: req.user!.sub,
      projectId: id,
    });

    return updated;
  });

  // POST /projects/:id/change-requests
  app.post("/projects/:id/change-requests", async (req, reply) => {
    const scope = await clientWriteScope(req, reply);
    if (scope === undefined) return;
    const { id } = req.params as { id: string };
    if (!(await assertProjectInScope(id, scope, reply))) return;
    const body = req.body as {
      title: string;
      description: string;
      urgency?: string;
      affectedMilestones?: number[];
    };

    const cr = await prisma.changeRequest.create({
      data: {
        id: ids.crId(),
        projectId: id,
        title: body.title,
        description: body.description,
        urgency: body.urgency ?? "MEDIUM",
        affectedMilestones: body.affectedMilestones ?? [],
        status: "SUBMITTED",
        raisedBy: req.user!.sub,
      },
    });

    await emitEvent({
      code: "CR_SUBMITTED",
      payload: { crId: cr.id },
      actor: req.user!.sub,
      projectId: id,
    });

    return cr;
  });

  // PATCH /projects/:id/change-requests/:crId/assess
  app.patch("/projects/:id/change-requests/:crId/assess", async (req, reply) => {
    const scope = await clientWriteScope(req, reply);
    if (scope === undefined) return;
    {
      const { id } = req.params as { id: string };
      if (!(await assertProjectInScope(id, scope, reply))) return;
    }
    const { crId } = req.params as { crId: string };
    const { costDelta, timelineDelta, scopeImpact } = req.body as {
      costDelta: number;
      timelineDelta: number;
      scopeImpact: string;
    };

    const updated = await prisma.changeRequest.update({
      where: { id: crId },
      data: { costDelta, timelineDelta, scopeImpact, status: "ASSESSED" },
    });

    await emitEvent({
      code: "CR_ASSESSED",
      payload: { crId, costDelta, timelineDelta },
      actor: req.user!.sub,
    });

    return updated;
  });

  // PATCH /projects/:id/change-requests/:crId/client-approve
  app.patch("/projects/:id/change-requests/:crId/client-approve", async (req, reply) => {
    const scope = await clientWriteScope(req, reply);
    if (scope === undefined) return;
    {
      const { id } = req.params as { id: string };
      if (!(await assertProjectInScope(id, scope, reply))) return;
    }
    const { crId } = req.params as { crId: string };

    const cr = await prisma.changeRequest.findUnique({ where: { id: crId } });
    if (!cr || cr.status !== "ASSESSED") {
      return reply.code(409).send({ error: "CR must be assessed first" });
    }

    // G-041: if cost delta > 0, create invoice before approving
    if (cr.costDelta && cr.costDelta > 0 && cr.projectId) {
      const project = await prisma.project.findUnique({ where: { id: cr.projectId }, include: { engagement: true } });
      if (project) {
        const invoice = await prisma.invoice.create({
          data: {
            id: ids.invoiceId(),
            engagementId: project.engagementId,
            orgId: project.engagement.clientId,
            milestoneRef: `CR-${crId}`,
            sacCode: "998314",
            gstType: "IGST",
            subtotal: cr.costDelta,
            igst: Math.round(cr.costDelta * 0.18),
            grandTotal: cr.costDelta + Math.round(cr.costDelta * 0.18),
            status: "SENT",
          },
        });
        await prisma.changeRequest.update({ where: { id: crId }, data: { invoiceId: invoice.id } });
      }
    }

    const updated = await prisma.changeRequest.update({
      where: { id: crId },
      data: { status: cr.costDelta && cr.costDelta > 0 ? "APPROVED" : "APPROVED" },
    });

    await emitEvent({ code: "CR_APPROVED", payload: { crId }, actor: req.user!.sub });
    return updated;
  });

  // PATCH /projects/:id/change-requests/:crId/client-reject
  app.patch("/projects/:id/change-requests/:crId/client-reject", async (req, reply) => {
    const scope = await clientWriteScope(req, reply);
    if (scope === undefined) return;
    {
      const { id } = req.params as { id: string };
      if (!(await assertProjectInScope(id, scope, reply))) return;
    }
    const { crId } = req.params as { crId: string };

    const updated = await prisma.changeRequest.update({
      where: { id: crId },
      data: { status: "REJECTED" },
    });

    await emitEvent({ code: "CR_REJECTED", payload: { crId }, actor: req.user!.sub });
    return updated;
  });

  // POST /projects/:id/reactivate — G-043 micro-SOW
  app.post("/projects/:id/reactivate", async (req, reply) => {
    const scope = await clientWriteScope(req, reply);
    if (scope === undefined) return;
    const { id } = req.params as { id: string };
    if (!(await assertProjectInScope(id, scope, reply))) return;

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) return reply.code(404).send({ error: "Project not found" });
    if (!["COMPLETED", "CANCELLED"].includes(project.status)) {
      return reply.code(409).send({ error: "Only completed/cancelled projects can be reactivated" });
    }

    // Create micro-SOW contract
    const contract = await prisma.contract.create({
      data: {
        engagementId: project.engagementId,
        type: "MICRO_SOW",
        status: "DRAFT",
      },
    });

    // Add single milestone
    const maxMilestone = await prisma.milestone.findFirst({
      where: { projectId: id },
      orderBy: { number: "desc" },
    });

    await prisma.milestone.create({
      data: {
        projectId: id,
        number: (maxMilestone?.number ?? 0) + 1,
        name: "Reactivation",
        paymentPct: 100,
        deliverables: (req.body as any)?.deliverables ?? [],
      },
    });

    const updated = await prisma.project.update({
      where: { id },
      data: { status: "ACTIVE" },
    });

    await emitEvent({
      code: "PROJECT_KICKED_OFF",
      payload: { projectId: id, reactivation: true, contractId: contract.id },
      actor: req.user!.sub,
      projectId: id,
    });

    return { project: updated, contract };
  });
}
