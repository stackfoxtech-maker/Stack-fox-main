import type { FastifyInstance } from "fastify";
import { prisma } from "@stackfox/prisma";
import { requireAuth } from "../plugins/auth";
import { emitEvent } from "../lib/events";
import { toJson } from "../lib/json";
import { requireRole } from "../plugins/auth";

export async function rfpRoutes(app: FastifyInstance) {
  app.get("/rfps", async (req, reply) => {
    // RFPs are StackFox's own bid pipeline, not client-facing.
    if (!requireRole(req, reply, ["ADMIN", "SUPER_ADMIN", "SALES", "SENIOR_PM", "SE"])) return;
    const { status, orgId } = req.query as Record<string, string>;
    const where: any = {};
    if (status) where.status = status;
    if (orgId) where.orgId = orgId;
    return prisma.rfp.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { org: { select: { id: true, name: true } } },
    });
  });

  app.post("/rfps", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const body = req.body as any;
    return prisma.rfp.create({
      data: {
        orgId: body.orgId,
        title: body.title,
        issuer: body.issuer ?? body.title ?? "Unknown issuer",
        budgetSignal: body.budgetSignal ?? null,
        brief: toJson(body.brief ?? {}),
        deadline: body.deadline ? new Date(body.deadline) : null,
        status: "INTAKE",
        createdBy: req.user!.sub,
      },
    });
  });

  app.patch("/rfps/:id/decision", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { id } = req.params as { id: string };
    const { decision, reason } = req.body as { decision: string; reason?: string };
    return prisma.rfp.update({
      where: { id },
      data: { status: decision, decisionNote: reason },
    });
  });

  app.post("/rfps/:id/submit", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { id } = req.params as { id: string };
    const updated = await prisma.rfp.update({
      where: { id },
      data: { status: "SUBMITTED", submittedAt: new Date() },
    });
    await emitEvent({
      code: "RFP_SUBMITTED",
      payload: { rfpId: id },
      actor: req.user!.sub,
    });
    return updated;
  });

  app.patch("/rfps/:id/outcome", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { id } = req.params as { id: string };
    const { outcome } = req.body as { outcome: string };
    return prisma.rfp.update({
      where: { id },
      data: { status: outcome },
    });
  });

  app.post("/rfps/:id/sdns", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { id } = req.params as { id: string };
    const body = req.body as any;
    return prisma.sdnNote.create({
      data: {
        rfpId: id,
        seUserId: req.user!.sub,
        content: toJson(body.content),
        category: body.category ?? "GENERAL",
      },
    });
  });

  app.get("/rfps/:id/sdns", async (req, reply) => {
    if (!requireRole(req, reply, ["ADMIN", "SUPER_ADMIN", "SALES", "SENIOR_PM", "SE"])) return;
    const { id } = req.params as { id: string };
    return prisma.sdnNote.findMany({
      where: { rfpId: id },
      orderBy: { createdAt: "desc" },
    });
  });
}
