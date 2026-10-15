import type { FastifyInstance } from "fastify";
import { prisma } from "@stackfox/prisma";
import { z } from "zod";
import { requireRole } from "../plugins/auth";
import { strictObject, parseBody } from "../lib/validate";
import { emitEvent } from "../lib/events";
import { ok } from "../lib/http";

/**
 * Who runs a project.
 *
 * `Project.pmUserId` is read by client messaging (it decides who a client's
 * message goes to) and by team reviews, but nothing ever wrote it, so every
 * project stayed "assigned later by PM" for ever. This is the missing step:
 * a lead picks a PM and the PM, and the client, are told.
 */

/** Who may be a project's PM. */
const PM_ROLES = ["ADMIN", "SENIOR_PM", "PM"];
/** Who may assign one. */
const ASSIGNER_ROLES = ["ADMIN", "SENIOR_PM"] as const;

const AssignPmSchema = strictObject({
  pmUserId: z.string().trim().min(1).max(120).nullable(),
});

export async function projectAssignmentRoutes(app: FastifyInstance) {
  // Staff who can be picked as PM, for the assignment dropdown.
  app.get("/projects/pm-options", async (req, reply) => {
    if (!requireRole(req, reply, ASSIGNER_ROLES)) return;
    const users = await prisma.user.findMany({
      where: { isActive: true, role: { in: PM_ROLES } },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    });
    return ok(users.map((u) => ({ ...u, _id: u.id })));
  });

  // Set, change or clear (null) a project's PM.
  app.patch("/projects/:id/pm", async (req, reply) => {
    if (!requireRole(req, reply, ASSIGNER_ROLES)) return;
    const { id } = req.params as { id: string };
    const body = parseBody(req, reply, AssignPmSchema);
    if (!body) return;

    const project = await prisma.project.findUnique({
      where: { id },
      select: { id: true, name: true, pmUserId: true },
    });
    if (!project) return reply.code(404).send({ error: "Project not found" });

    if (body.pmUserId) {
      const pm = await prisma.user.findUnique({ where: { id: body.pmUserId } });
      if (!pm || !pm.isActive || !PM_ROLES.includes(pm.role)) {
        return reply
          .code(400)
          .send({ error: "Pick an active project manager (PM, SENIOR_PM or ADMIN)." });
      }
    }
    if (body.pmUserId === project.pmUserId) return ok({ id, pmUserId: project.pmUserId });

    await prisma.project.update({ where: { id }, data: { pmUserId: body.pmUserId } });

    if (body.pmUserId) {
      await prisma.notification.create({
        data: {
          userId: body.pmUserId,
          title: "You are now the PM",
          body: project.name ?? project.id,
          link: `/app/team/projects/${id}`,
        },
      });
    }
    // The client's own users are told through the normal event fan-out.
    await emitEvent({
      code: "PROJECT_PM_ASSIGNED",
      payload: { projectId: id, pmUserId: body.pmUserId },
      actor: req.user!.sub,
      projectId: id,
    });

    return ok({ id, pmUserId: body.pmUserId });
  });
}
