import type { FastifyInstance } from "fastify";
import { prisma } from "@stackfox/prisma";
import { requireAuth, requireRole } from "../plugins/auth";
import { emitEvent } from "../lib/events";

export async function feedbackRoutes(app: FastifyInstance) {
  app.post("/feedback", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { projectRef, rating, nps, comment } = req.body as {
      projectRef?: string;
      rating?: number;
      nps?: number;
      comment?: string;
    };
    if (!rating || rating < 1 || rating > 5) {
      return reply.code(400).send({ message: "rating (1-5) is required" });
    }

    const feedback = await prisma.feedback.create({
      data: {
        raisedBy: req.user!.sub,
        projectRef: projectRef ?? null,
        rating,
        nps: nps ?? 0,
        comment: comment ?? null,
      },
    });

    await emitEvent({ code: "FEEDBACK_SUBMITTED", payload: { feedbackId: feedback.id, rating }, actor: req.user!.sub });

    return { data: feedback };
  });

  app.get("/feedback/admin", async (req, reply) => {
    if (!requireRole(req, reply, ["ADMIN", "SE", "SENIOR_PM"])) return;
    const items = await prisma.feedback.findMany({
      orderBy: { createdAt: "desc" },
    });
    return { data: items };
  });

  app.get("/feedback", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const items = await prisma.feedback.findMany({
      where: { raisedBy: req.user!.sub },
      orderBy: { createdAt: "desc" },
    });
    return { data: items };
  });
}
