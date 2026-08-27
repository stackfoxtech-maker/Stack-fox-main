import type { FastifyInstance } from "fastify";
import { prisma } from "@stackfox/prisma";
import { requireAuth } from "../plugins/auth";
import { emitEvent } from "../lib/events";
import * as ids from "../lib/id";

// Client-facing change requests, not tied to a specific project — mirrors
// the project-scoped /projects/:id/change-requests used by PM-side flows,
// but scoped to the raising client instead (same ChangeRequest table).
export async function changeRequestRoutes(app: FastifyInstance) {
  app.post("/change-requests", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { title, description, urgency } = req.body as {
      title?: string;
      description?: string;
      urgency?: string;
    };
    if (!title || !description) {
      return reply.code(400).send({ message: "title and description are required" });
    }

    const cr = await prisma.changeRequest.create({
      data: {
        id: ids.crId(),
        title,
        description,
        urgency: urgency ?? "MEDIUM",
        affectedMilestones: [],
        status: "SUBMITTED",
        raisedBy: req.user!.sub,
      },
    });

    await emitEvent({ code: "CR_SUBMITTED", payload: { crId: cr.id }, actor: req.user!.sub });

    return { data: cr };
  });

  app.get("/change-requests", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const items = await prisma.changeRequest.findMany({
      where: { raisedBy: req.user!.sub },
      orderBy: { createdAt: "desc" },
    });
    return { data: items };
  });
}
