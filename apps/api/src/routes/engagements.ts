import type { FastifyInstance } from "fastify";
import { prisma } from "@stackfox/prisma";
import { requireAuth, requireRole } from "../plugins/auth";
import { emitEvent } from "../lib/events";
import { canTransition } from "@stackfox/core";
import { clientScope, clientWriteScope, assertEngagementInScope } from "../lib/scope";
import { ok, withId, withIds } from "../lib/http";

const ENGAGEMENT_TRANSITIONS = [
  { from: "DRAFT", to: "ACTIVE" },
  { from: "ACTIVE", to: "PAUSED" },
  { from: "PAUSED", to: "ACTIVE" },
  { from: "ACTIVE", to: "COMPLETED" },
  { from: "ACTIVE", to: "TERMINATED" },
];

export async function engagementRoutes(app: FastifyInstance) {
  app.post("/engagements", async (req, reply) => {
    // Engagements are created by StackFox as part of order fulfilment, never
    // self-served by a client.
    if (!requireRole(req, reply, ["ADMIN", "SUPER_ADMIN", "PM", "SENIOR_PM", "SALES"])) return;
    const body = req.body as any;
    const { engagementId } = await import("../lib/id");
    return prisma.engagement.create({
      data: {
        id: engagementId(),
        clientId: body.clientId,
        model: body.model,
        commercial: body.commercial ?? {},
        methodology: body.methodology ?? "MILESTONE",
        status: "DRAFT",
      },
    });
  });

  app.get("/engagements/:id", async (req, reply) => {
    const scope = await clientScope(req, reply);
    if (scope === undefined) return;

    const { id } = req.params as { id: string };
    if (!(await assertEngagementInScope(id, scope, reply))) return;

    const eng = await prisma.engagement.findUnique({
      where: { id },
      include: { projects: true, contracts: true, invoices: true },
    });
    if (!eng) return reply.code(404).send({ error: "Engagement not found" });
    return ok(withId(eng));
  });

  app.get("/engagements", async (req, reply) => {
    const scope = await clientScope(req, reply);
    if (scope === undefined) return;

    const { clientId, model } = req.query as { clientId?: string; model?: string };
    const where: any = {};
    if (scope !== null) where.clientId = scope;
    else if (clientId) where.clientId = clientId;
    if (model) where.model = model;

    const items = await prisma.engagement.findMany({
      where,
      include: { projects: { select: { id: true, name: true, status: true } } },
      orderBy: { createdAt: "desc" },
    });
    return ok(withIds(items));
  });

  app.patch("/engagements/:id/status", async (req, reply) => {
    const scope = await clientWriteScope(req, reply);
    if (scope === undefined) return;
    const { id } = req.params as { id: string };
    if (!(await assertEngagementInScope(id, scope, reply))) return;
    const { status } = req.body as { status: string };

    const eng = await prisma.engagement.findUnique({ where: { id } });
    if (!eng) return reply.code(404).send({ error: "Engagement not found" });

    if (!canTransition(eng.status, status, ENGAGEMENT_TRANSITIONS as any)) {
      return reply.code(409).send({ error: `Cannot transition from ${eng.status} to ${status}` });
    }

    const updated = await prisma.engagement.update({
      where: { id },
      data: {
        status,
        ...(status === "ACTIVE" ? { executedAt: new Date() } : {}),
        ...(status === "COMPLETED" || status === "TERMINATED" ? { endsAt: new Date() } : {}),
      },
    });

    const codeMap: Record<string, string> = {
      ACTIVE: "ENGAGEMENT_ACTIVATED",
      PAUSED: "ENGAGEMENT_PAUSED",
      COMPLETED: "ENGAGEMENT_COMPLETED",
      TERMINATED: "ENGAGEMENT_TERMINATED",
    };

    if (codeMap[status]) {
      await emitEvent({
        code: codeMap[status],
        payload: { engagementId: id },
        actor: req.user!.sub,
        engagementId: id,
      });
    }

    return updated;
  });
}
