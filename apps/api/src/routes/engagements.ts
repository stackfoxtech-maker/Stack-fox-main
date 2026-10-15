import type { FastifyInstance } from "fastify";
import { prisma } from "@stackfox/prisma";
import { requireRole } from "../plugins/auth";
import { emitEvent } from "../lib/events";
import { DELIVERY_ROLES, SALES_ROLES, canTransition } from "@stackfox/core";
import { clientScope, clientWriteScope, assertEngagementInScope } from "../lib/scope";
import { LIST_CAP, ok, withId, withIds } from "../lib/http";
import { parseBody } from "../lib/validate";
import { CreateEngagementSchema, UpdateEngagementStatusSchema } from "./opsSchemas";

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
    if (!requireRole(req, reply, SALES_ROLES)) return;
    const body = parseBody(req, reply, CreateEngagementSchema);
    if (!body) return;
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
      take: LIST_CAP,
      where,
      include: { projects: { select: { id: true, name: true, status: true } } },
      orderBy: { createdAt: "desc" },
    });
    return ok(withIds(items));
  });

  // Staff only. A client owner could drive their own engagement to ACTIVE (skipping
  // contracting and payment) or COMPLETED/TERMINATED, like the project status route.
  app.patch("/engagements/:id/status", async (req, reply) => {
    if (!requireRole(req, reply, DELIVERY_ROLES)) return;
    const { id } = req.params as { id: string };
    const stBody = parseBody(req, reply, UpdateEngagementStatusSchema);
    if (!stBody) return;
    const { status } = stBody;

    const eng = await prisma.engagement.findUnique({ where: { id } });
    if (!eng) return reply.code(404).send({ error: "Engagement not found" });

    if (!canTransition(eng.status, status, ENGAGEMENT_TRANSITIONS as any)) {
      return reply
        .code(409)
        .send({ error: `Cannot transition from ${eng.status} to ${status}` });
    }

    const updated = await prisma.engagement.update({
      where: { id },
      data: {
        status,
        // Only the first activation is the execution date; a resume must not overwrite it.
        ...(status === "ACTIVE" && !eng.executedAt ? { executedAt: new Date() } : {}),
        ...(status === "COMPLETED" || status === "TERMINATED"
          ? { endsAt: new Date() }
          : {}),
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
