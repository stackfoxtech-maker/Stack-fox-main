import type { FastifyInstance } from "fastify";
import { prisma } from "@stackfox/prisma";
import { canonicalHash } from "../lib/hash";
import { emitEvent } from "../lib/events";
import { generateStructured } from "../lib/gemini";
import { resolveDependencies, type DependencyEdge } from "@stackfox/core";

import { requireRole } from "../plugins/auth";
import { isInternalRole } from "@stackfox/core";
import type { FastifyRequest, FastifyReply } from "fastify";

/**
 * Workspace access.
 *
 * The service builder is deliberately usable before signup, so a workspace with
 * no `userId` is a guest draft reachable by anyone holding its (unguessable)
 * UUID. The moment it belongs to a user, only that user — or internal staff —
 * may read or change it. Previously every route here was open, so any workspace
 * id could be read and edited by anyone.
 *
 * Returns the workspace, or null after sending the response.
 */
async function workspaceInScope(
  id: string,
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const ws = await prisma.workspace.findUnique({
    where: { id },
    include: { customLineItems: { orderBy: { sortOrder: "asc" } } },
  });
  if (!ws) {
    reply.code(404).send({ error: "Workspace not found" });
    return null;
  }

  // Guest draft — no owner to check against.
  if (!ws.userId) return ws;

  if (isInternalRole(req.user?.role)) return ws;
  if (req.user?.sub === ws.userId) return ws;

  reply.code(404).send({ error: "Workspace not found" });
  return null;
}

export async function workspaceRoutes(app: FastifyInstance) {
  // GET /workspaces — the caller's own drafts.
  app.get("/workspaces", async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: "Authentication required" });
    const items = await prisma.workspace.findMany({
      where: isInternalRole(req.user.role) ? {} : { userId: req.user.sub },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });
    return { data: items.map((w) => ({ ...w, _id: w.id })) };
  });

  // POST /workspaces
  app.post("/workspaces", async (req) => {
    const canvas = (req.body as any)?.canvas ?? [];
    return prisma.workspace.create({
      data: {
        userId: req.user?.sub,
        canvas,
        canonicalHash: canonicalHash(canvas),
      },
    });
  });

  // GET /workspaces/:id
  app.get("/workspaces/:id", async (req, reply) => {
    const ws = await workspaceInScope((req.params as { id: string }).id, req, reply);
    if (!ws) return;
    return ws;
  });

  // PATCH /workspaces/:id
  app.patch("/workspaces/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!(await workspaceInScope(id, req, reply))) return;
    const body = req.body as { canvas?: any[]; timelineMult?: number };
    const data: any = {};
    if (body.canvas) {
      data.canvas = body.canvas;
      data.canonicalHash = canonicalHash(body.canvas);
    }
    if (body.timelineMult !== undefined) data.timelineMult = body.timelineMult;

    return prisma.workspace.update({ where: { id }, data });
  });

  // POST /workspaces/:id/add-service
  app.post("/workspaces/:id/add-service", async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!(await workspaceInScope(id, req, reply))) return;
    const { serviceId } = req.body as { serviceId: string };

    const ws = await prisma.workspace.findUnique({ where: { id } });
    if (!ws) return reply.code(404).send({ error: "Workspace not found" });

    const service = await prisma.serviceUnit.findUnique({
      where: { id: serviceId },
      include: { featureUnits: true },
    });
    if (!service) return reply.code(404).send({ error: "Service not found" });

    const canvas = ws.canvas as any[];
    if (canvas.some((s: any) => s.serviceId === serviceId)) {
      return reply.code(409).send({ error: "Service already in workspace" });
    }

    // Resolve dependencies
    const deps = await prisma.dependency.findMany({ where: { fromId: serviceId } });
    const edges: DependencyEdge[] = deps.map((d) => ({
      fromId: d.fromId,
      toId: d.toId,
      type: d.type as any,
    }));
    const selectedIds = canvas.map((s: any) => s.serviceId);
    const resolution = resolveDependencies([...selectedIds, serviceId], edges);

    const features: Record<string, boolean> = {};
    for (const f of service.featureUnits) {
      features[f.id] = f.defaultState;
    }

    canvas.push({ serviceId, features });

    // Auto-add REQUIRES dependencies
    for (const reqId of resolution.required) {
      if (!canvas.some((s: any) => s.serviceId === reqId)) {
        const reqService = await prisma.serviceUnit.findUnique({
          where: { id: reqId },
          include: { featureUnits: true },
        });
        if (reqService) {
          const reqFeatures: Record<string, boolean> = {};
          for (const f of reqService.featureUnits) reqFeatures[f.id] = f.defaultState;
          canvas.push({ serviceId: reqId, features: reqFeatures });
        }
      }
    }

    const updated = await prisma.workspace.update({
      where: { id },
      data: { canvas, canonicalHash: canonicalHash(canvas) },
    });

    await emitEvent({
      code: "WORKSPACE_SERVICE_ADDED",
      payload: { serviceId, dependencies: resolution },
      actor: req.user?.sub ?? "ANONYMOUS",
    });

    return { workspace: updated, dependencies: resolution };
  });

  // POST /workspaces/:id/remove-service
  app.post("/workspaces/:id/remove-service", async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!(await workspaceInScope(id, req, reply))) return;
    const { serviceId } = req.body as { serviceId: string };

    const ws = await prisma.workspace.findUnique({ where: { id } });
    if (!ws) return reply.code(404).send({ error: "Workspace not found" });

    const canvas = (ws.canvas as any[]).filter((s: any) => s.serviceId !== serviceId);

    // Check if any remaining services require the removed one
    const dependants = await prisma.dependency.findMany({
      where: { toId: serviceId, type: "REQUIRES" },
    });
    const warnings = dependants
      .filter((d) => canvas.some((s: any) => s.serviceId === d.fromId))
      .map((d) => d.fromId);

    const updated = await prisma.workspace.update({
      where: { id },
      data: { canvas, canonicalHash: canonicalHash(canvas) },
    });

    await emitEvent({
      code: "WORKSPACE_SERVICE_REMOVED",
      payload: { serviceId },
      actor: req.user?.sub ?? "ANONYMOUS",
    });

    return { workspace: updated, warnings: warnings.length > 0 ? `Services ${warnings.join(", ")} require ${serviceId}` : null };
  });

  // PATCH /workspaces/:id/toggle-feature
  app.patch("/workspaces/:id/toggle-feature", async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!(await workspaceInScope(id, req, reply))) return;
    const { serviceId, featureId, enabled } = req.body as {
      serviceId: string;
      featureId: string;
      enabled: boolean;
    };

    const ws = await prisma.workspace.findUnique({ where: { id } });
    if (!ws) return reply.code(404).send({ error: "Workspace not found" });

    const canvas = ws.canvas as any[];
    const serviceEntry = canvas.find((s: any) => s.serviceId === serviceId);
    if (!serviceEntry) return reply.code(404).send({ error: "Service not in workspace" });

    serviceEntry.features[featureId] = enabled;

    // Calculate estimate delta
    const feature = await prisma.featureUnit.findUnique({ where: { id: featureId } });
    const rateCard = await prisma.rateCard.findFirst({
      where: { type: "POINT", key: "point" },
      orderBy: { effectiveFrom: "desc" },
    });
    const pointRate = rateCard?.rate ?? 280000;
    const delta = feature ? (enabled ? 1 : -1) * feature.weight * pointRate : 0;

    const updated = await prisma.workspace.update({
      where: { id },
      data: { canvas, canonicalHash: canonicalHash(canvas) },
    });

    await emitEvent({
      code: "WORKSPACE_FEATURE_TOGGLED",
      payload: { serviceId, featureId, enabled },
      actor: req.user?.sub ?? "ANONYMOUS",
    });

    return { workspace: updated, estimateDelta: delta };
  });

  // POST /workspaces/:id/add-custom-line
  app.post("/workspaces/:id/add-custom-line", async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!(await workspaceInScope(id, req, reply))) return;
    const body = req.body as {
      title: string;
      description: string;
      acceptCriteria: string;
      deliverables?: string[];
      estHours: Record<string, { o: number; l: number; p: number }>;
      confidence: string;
    };

    const ws = await prisma.workspace.findUnique({ where: { id } });
    if (!ws) return reply.code(404).send({ error: "Workspace not found" });

    const line = await prisma.customLine.create({
      data: {
        workspaceId: id,
        title: body.title,
        description: body.description,
        acceptCriteria: body.acceptCriteria,
        deliverables: body.deliverables ?? [],
        estHours: body.estHours,
        confidence: body.confidence,
      },
    });

    await emitEvent({
      code: "WORKSPACE_CUSTOM_LINE_ADDED",
      payload: { lineId: line.id },
      actor: req.user?.sub ?? "ANONYMOUS",
    });

    return line;
  });

  // PATCH /workspaces/:id/custom-lines/:lineId
  app.patch("/workspaces/:id/custom-lines/:lineId", async (req, reply) => {
    if (!(await workspaceInScope((req.params as { id: string }).id, req, reply))) return;
    const { lineId } = req.params as { lineId: string };
    const body = req.body as Partial<{
      title: string;
      description: string;
      acceptCriteria: string;
      estHours: Record<string, { o: number; l: number; p: number }>;
      confidence: string;
    }>;
    return prisma.customLine.update({ where: { id: lineId }, data: body as any });
  });

  // DELETE /workspaces/:id/custom-lines/:lineId
  app.delete("/workspaces/:id/custom-lines/:lineId", async (req, reply) => {
    if (!(await workspaceInScope((req.params as { id: string }).id, req, reply))) return;
    const { lineId } = req.params as { lineId: string };
    await prisma.customLine.delete({ where: { id: lineId } });
    return { success: true };
  });

  // POST /workspaces/:id/submit-se-review
  app.post("/workspaces/:id/submit-se-review", async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: "Auth required" });
    const { id } = req.params as { id: string };
    if (!(await workspaceInScope(id, req, reply))) return;

    const updated = await prisma.workspace.update({
      where: { id },
      data: { seStatus: "SE_QUEUE" },
    });

    await emitEvent({
      code: "WORKSPACE_SE_REVIEW_REQUESTED",
      payload: { workspaceId: id },
      actor: req.user.sub,
    });

    return updated;
  });

  // POST /workspaces/:id/se-approve
  app.post("/workspaces/:id/se-approve", async (req, reply) => {
    // Solution-engineer sign-off. Checking only that *someone* was logged in
    // let a client approve their own workspace and skip review entirely.
    if (!requireRole(req, reply, ["SE", "SENIOR_PM", "ADMIN", "SUPER_ADMIN"])) return;
    const { id } = req.params as { id: string };

    const updated = await prisma.workspace.update({
      where: { id },
      data: { seStatus: "SE_APPROVED", seUserId: req.user!.sub },
    });

    await emitEvent({
      code: "WORKSPACE_SE_APPROVED",
      payload: { workspaceId: id },
      actor: req.user!.sub,
    });

    return updated;
  });

  // POST /workspaces/:id/se-return
  app.post("/workspaces/:id/se-return", async (req, reply) => {
    // Solution-engineer sign-off. Checking only that *someone* was logged in
    // let a client approve their own workspace and skip review entirely.
    if (!requireRole(req, reply, ["SE", "SENIOR_PM", "ADMIN", "SUPER_ADMIN"])) return;
    const { id } = req.params as { id: string };
    const { notes } = req.body as { notes: string };

    const updated = await prisma.workspace.update({
      where: { id },
      data: { seStatus: "SE_RETURNED", seUserId: req.user!.sub },
    });

    await emitEvent({
      code: "WORKSPACE_SE_RETURNED",
      payload: { workspaceId: id, notes },
      actor: req.user!.sub,
    });

    return updated;
  });

  // POST /workspaces/:id/copy
  app.post("/workspaces/:id/copy", async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!(await workspaceInScope(id, req, reply))) return;
    const ws = await prisma.workspace.findUnique({
      where: { id },
      include: { customLineItems: true },
    });
    if (!ws) return reply.code(404).send({ error: "Workspace not found" });

    const copy = await prisma.workspace.create({
      data: {
        userId: req.user?.sub,
        canvas: ws.canvas as any,
        customLines: ws.customLines as any,
        canonicalHash: ws.canonicalHash,
        timelineMult: ws.timelineMult,
      },
    });

    // Copy custom lines
    for (const line of ws.customLineItems) {
      await prisma.customLine.create({
        data: {
          workspaceId: copy.id,
          title: line.title,
          description: line.description,
          acceptCriteria: line.acceptCriteria,
          deliverables: line.deliverables as any,
          estHours: line.estHours as any,
          confidence: line.confidence,
          sortOrder: line.sortOrder,
        },
      });
    }

    return copy;
  });

  // POST /workspaces/:id/advisor — AI Scope Advisor
  app.post("/workspaces/:id/advisor", async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!(await workspaceInScope(id, req, reply))) return;
    const { answers } = req.body as { answers: Record<string, string> };

    const services = await prisma.serviceUnit.findMany({
      where: { status: "PUBLISHED" },
      include: { featureUnits: true, packages: true },
    });

    const prompt = `You are the StackFox AI Scope Advisor. Based on these answers to our 10-question discovery flow, recommend a project configuration.

Answers: ${JSON.stringify(answers)}

Available services (IDs and names): ${services.map((s) => `${s.id}: ${s.name} (category: ${s.categoryTier1})`).join("\n")}

Return JSON with:
{
  "recommended": { "services": [{"serviceId": "...", "features": {"featureId": true/false}}], "tier": "STARTER|GROWTH|PREMIUM", "rationale": "..." },
  "lighter": { "services": [...], "tier": "...", "rationale": "..." },
  "heavier": { "services": [...], "tier": "...", "rationale": "..." },
  "starterMatch": null or { "packageId": "...", "price": number }
}`;

    const result = await generateStructured<any>(prompt);

    await emitEvent({
      code: "DISC_005",
      payload: { workspaceId: id, answers, result },
      actor: req.user?.sub ?? "ANONYMOUS",
    });

    return result;
  });
}
