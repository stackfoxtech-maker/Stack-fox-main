import type { FastifyInstance } from "fastify";
import { prisma } from "@stackfox/prisma";
import { requireAuth } from "../plugins/auth";
import { emitEvent } from "../lib/events";
import * as ids from "../lib/id";
import { LIST_CAP } from "../lib/http";
import { parseBody } from "../lib/validate";
import { CreateChangeRequestSchema } from "./deliverySchemas";

// Client-facing change requests, not tied to a specific project — mirrors
// the project-scoped /projects/:id/change-requests used by PM-side flows,
// but scoped to the raising client instead (same ChangeRequest table).
export async function changeRequestRoutes(app: FastifyInstance) {
  app.post("/change-requests", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const body = parseBody(req, reply, CreateChangeRequestSchema);
    if (!body) return;
    const { title, description, urgency } = body;

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

    await emitEvent({
      code: "CR_SUBMITTED",
      payload: { crId: cr.id },
      actor: req.user!.sub,
    });

    return { data: cr };
  });

  app.get("/change-requests", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const items = await prisma.changeRequest.findMany({
      take: LIST_CAP,
      where: { raisedBy: req.user!.sub },
      orderBy: { createdAt: "desc" },
    });
    return { data: items };
  });
}
