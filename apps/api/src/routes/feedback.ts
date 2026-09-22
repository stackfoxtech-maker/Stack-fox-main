import type { FastifyInstance } from "fastify";
import { prisma } from "@stackfox/prisma";
import { requireAuth, requireRole } from "../plugins/auth";
import { emitEvent } from "../lib/events";
import { CATALOGUE_ROLES } from "@stackfox/core";
import { LIST_CAP } from "../lib/http";
import { parseBody } from "../lib/validate";
import { CreateFeedbackSchema } from "./opsSchemas";

export async function feedbackRoutes(app: FastifyInstance) {
  app.post("/feedback", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const body = parseBody(req, reply, CreateFeedbackSchema);
    if (!body) return;
    const { projectRef, rating, nps, comment } = body;

    const feedback = await prisma.feedback.create({
      data: {
        raisedBy: req.user!.sub,
        projectRef: projectRef ?? null,
        rating,
        nps: nps ?? 0,
        comment: comment ?? null,
      },
    });

    await emitEvent({
      code: "FEEDBACK_SUBMITTED",
      payload: { feedbackId: feedback.id, rating },
      actor: req.user!.sub,
    });

    return { data: feedback };
  });

  app.get("/feedback/admin", async (req, reply) => {
    if (!requireRole(req, reply, CATALOGUE_ROLES)) return;
    const items = await prisma.feedback.findMany({
      take: LIST_CAP,
      orderBy: { createdAt: "desc" },
    });
    return { data: items };
  });

  app.get("/feedback", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const items = await prisma.feedback.findMany({
      take: LIST_CAP,
      where: { raisedBy: req.user!.sub },
      orderBy: { createdAt: "desc" },
    });
    return { data: items };
  });
}
