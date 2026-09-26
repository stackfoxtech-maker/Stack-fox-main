import type { FastifyInstance } from "fastify";
import { prisma } from "@stackfox/prisma";
import { estimateInputHash } from "../lib/hash";
import { emitEvent } from "../lib/events";
import { queues } from "../lib/queue";
import * as ids from "../lib/id";
import type { FastifyRequest, FastifyReply } from "fastify";
import { isInternalRole } from "@stackfox/core";
import { issueDownload } from "../lib/documentIntegrity";
import { parseBody } from "../lib/validate";
import { CreateEstimateSchema } from "./opsSchemas";

/**
 * Estimates were fully open: GET /estimates/:id returned the client's service
 * canvas, custom lines, discount and grand total to anyone, and the ids are
 * only 4 decimal digits wide (lib/id.ts), so the whole book was enumerable in
 * ~10,000 requests per month-prefix.
 *
 * Same rule workspaces.ts already applies: an estimate whose workspace has no
 * owner is a guest draft, reachable by its unguessable id so the pre-signup
 * builder keeps working. Once it belongs to a user, only that user or internal
 * staff may read it.
 */
async function estimateInScope(id: string, req: FastifyRequest, reply: FastifyReply) {
  const est = await prisma.estimate.findUnique({
    where: { id },
    include: { workspace: { select: { userId: true } } },
  });
  if (!est) {
    reply.code(404).send({ error: "Estimate not found" });
    return null;
  }

  const ownerId = est.workspace?.userId ?? null;
  if (!ownerId) return est; // guest draft
  if (isInternalRole(req.user?.role)) return est;
  if (req.user?.sub === ownerId) return est;

  // 404 not 403 — a 403 would confirm the id exists.
  reply.code(404).send({ error: "Estimate not found" });
  return null;
}

export async function estimateRoutes(app: FastifyInstance) {
  // POST /estimates — generate from workspace
  app.post("/estimates", async (req, reply) => {
    const estBody = parseBody(req, reply, CreateEstimateSchema);
    if (!estBody) return;
    const { workspaceId } = estBody;
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { customLineItems: true },
    });
    if (
      !ws ||
      (ws.userId && ws.userId !== req.user?.sub && !isInternalRole(req.user?.role))
    )
      return reply.code(404).send({ error: "Workspace not found" });

    const canvas = ws.canvas as any[];
    const rateCard = await prisma.rateCard.findFirst({
      where: { type: "POINT", key: "point" },
      orderBy: { effectiveFrom: "desc" },
    });
    const pointRate = Number(rateCard?.rate ?? 280000);

    // Calculate totals
    let basePoints = 0;
    let featurePoints = 0;

    for (const item of canvas) {
      const service = await prisma.serviceUnit.findUnique({
        where: { id: item.serviceId },
        include: { featureUnits: true },
      });
      if (!service) continue;
      basePoints += service.baseWeight;

      for (const feat of service.featureUnits) {
        if (item.features[feat.id]) {
          featurePoints += feat.weight;
        }
      }
    }

    // Custom lines — PERT: E = (O + 4L + P) / 6
    let customTotal = 0;
    for (const line of ws.customLineItems) {
      const hours = line.estHours as Record<string, { o: number; l: number; p: number }>;
      for (const role of Object.values(hours)) {
        const pert = (role.o + 4 * role.l + role.p) / 6;
        // Convert hours to points (8h = 1 point approx)
        customTotal += Math.ceil(pert / 8) * pointRate;
      }
    }

    const timelineMult = Number(ws.timelineMult);
    const baseTotal = basePoints * pointRate;
    const featureTotal = featurePoints * pointRate;
    const subtotal = Math.round((baseTotal + featureTotal + customTotal) * timelineMult);

    // Bundle discount detection
    const bundles = await prisma.bundle.findMany({ where: { status: "ACTIVE" } });
    let discount = 0;
    for (const bundle of bundles) {
      const members = bundle.members as any[];
      const selectedIds = canvas.map((s: any) => s.serviceId);
      const matched = members.filter((m: any) =>
        selectedIds.includes(m.serviceId),
      ).length;
      const matchPct = (matched / members.length) * 100;
      if (matchPct >= bundle.matchThreshold) {
        discount = Math.max(discount, bundle.discountPct);
      }
    }

    const discountAmount = Math.round(subtotal * (discount / 100));
    const afterDiscount = subtotal - discountAmount;
    const gst = Math.round(afterDiscount * 0.18);
    const grand = afterDiscount + gst;

    const snapshot = {
      canvas,
      customLines: ws.customLineItems,
      timelineMult,
    };

    // Must match what routes/checkout.ts recomputes, or the G-039 drift
    // guard rejects every checkout.
    const hash = estimateInputHash({
      canvas,
      customLines: ws.customLineItems,
      timelineMult,
    });

    const estimate = await prisma.estimate.create({
      data: {
        id: ids.estimateId(),
        workspaceId,
        snapshot,
        hash,
        rateVersion: rateCard?.id ?? "default",
        totals: {
          base: baseTotal,
          features: featureTotal,
          custom: customTotal,
          mult: timelineMult,
          discount: discountAmount,
          subtotal: afterDiscount,
          gst,
          grand,
        },
        lockedUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days
        status: "ACTIVE",
      },
    });

    // Queue PDF generation
    await queues.docGen.add("estimate-pdf", {
      type: "estimate",
      estimateId: estimate.id,
    });

    await emitEvent({
      code: "ESTIMATE_GENERATED",
      payload: { estimateId: estimate.id, grand },
      actor: req.user?.sub ?? "ANONYMOUS",
    });

    return estimate;
  });

  // GET /estimates/:id
  app.get("/estimates/:id", async (req, reply) => {
    const est = await estimateInScope((req.params as { id: string }).id, req, reply);
    if (!est) return;
    return est;
  });

  // GET /estimates/:id/pdf
  app.get("/estimates/:id/pdf", async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!(await estimateInScope(id, req, reply))) return;

    const url = await issueDownload(req, {
      documentType: "ESTIMATE",
      documentId: id,
      storageKey: `estimates/${id}.pdf`,
    });
    return { url };
  });
}
