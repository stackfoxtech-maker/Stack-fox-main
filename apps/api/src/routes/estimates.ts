import type { FastifyInstance } from "fastify";
import { prisma } from "@stackfox/prisma";
import { canonicalHash, sha256 } from "../lib/hash";
import { emitEvent } from "../lib/events";
import { queues } from "../lib/queue";
import * as ids from "../lib/id";

export async function estimateRoutes(app: FastifyInstance) {
  // POST /estimates — generate from workspace
  app.post("/estimates", async (req, reply) => {
    const { workspaceId } = req.body as { workspaceId: string };
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { customLineItems: true },
    });
    if (!ws) return reply.code(404).send({ error: "Workspace not found" });

    const canvas = ws.canvas as any[];
    const rateCard = await prisma.rateCard.findFirst({
      where: { type: "POINT", key: "point" },
      orderBy: { effectiveFrom: "desc" },
    });
    const pointRate = rateCard?.rate ?? 280000;

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
      const matched = members.filter((m: any) => selectedIds.includes(m.serviceId)).length;
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

    const hash = sha256(JSON.stringify(snapshot));

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
    const { id } = req.params as { id: string };
    const est = await prisma.estimate.findUnique({ where: { id } });
    if (!est) return reply.code(404).send({ error: "Estimate not found" });
    return est;
  });

  // GET /estimates/:id/pdf
  app.get("/estimates/:id/pdf", async (req, reply) => {
    const { id } = req.params as { id: string };
    const est = await prisma.estimate.findUnique({ where: { id } });
    if (!est) return reply.code(404).send({ error: "Estimate not found" });

    const { getPresignedDownload } = await import("../lib/storage");
    const url = await getPresignedDownload(`estimates/${id}.pdf`);
    return { url };
  });

  // POST /estimates/:id/refresh
  app.post("/estimates/:id/refresh", async (req, reply) => {
    const { id } = req.params as { id: string };
    const est = await prisma.estimate.findUnique({ where: { id } });
    if (!est) return reply.code(404).send({ error: "Estimate not found" });

    // Re-generate with current rates by creating workspace-like body
    const snapshot = est.snapshot as any;
    const ws = await prisma.workspace.findUnique({ where: { id: est.workspaceId } });
    if (!ws) return reply.code(404).send({ error: "Workspace not found" });

    // Trigger new estimate generation
    return reply.redirect(307, "/estimates");
  });
}
