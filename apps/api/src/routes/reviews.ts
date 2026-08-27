import type { FastifyInstance } from "fastify";
import { prisma } from "@stackfox/prisma";
import { requireAuth, requireRole } from "../plugins/auth";

export async function reviewRoutes(app: FastifyInstance) {
  app.get("/reviews/my", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const items = await prisma.review.findMany({
      where: { revieweeId: req.user!.sub },
      orderBy: { createdAt: "desc" },
    });
    return { data: items };
  });

  app.get("/reviews/pending", async (req, reply) => {
    if (!requireAuth(req, reply)) return;

    const completed = await prisma.review.findMany({
      where: { reviewerId: req.user!.sub },
      select: { revieweeId: true, period: true },
    });

    const done = new Set(completed.map((r) => `${r.revieweeId}:${r.period}`));

    // Performance reviews are between people. The previous version returned
    // `engagement.clientId` — an Org id — as `revieweeId`, but that column is a
    // foreign key to User, so every submission failed on the constraint.
    // Reviewable people are the teammates assigned to work this PM oversees.
    const projects = await prisma.project.findMany({
      where: { pmUserId: req.user!.sub },
      select: { id: true, name: true },
      take: 50,
    });
    const projectIds = projects.map((p) => p.id);
    const projectName = new Map(projects.map((p) => [p.id, p.name || p.id]));

    const taskRows = await prisma.task.findMany({
      where: { projectId: { in: projectIds } },
      select: { assigneeId: true, projectId: true },
      distinct: ["assigneeId", "projectId"],
    });

    // Prisma types assigneeId as nullable, so narrow before use rather than
    // filtering inside the query.
    const assignments = taskRows.filter(
      (t): t is { assigneeId: string; projectId: string } =>
        typeof t.assigneeId === "string" && t.assigneeId !== req.user!.sub,
    );

    const assigneeIds = [...new Set(assignments.map((a) => a.assigneeId))];

    const people = await prisma.user.findMany({
      where: { id: { in: assigneeIds }, isActive: true },
      select: { id: true, name: true, role: true, designation: true },
    });
    const person = new Map(people.map((p) => [p.id, p]));

    const period = String(new Date().getFullYear());
    const pending = assignments
      .filter((a) => person.has(a.assigneeId) && !done.has(`${a.assigneeId}:${period}`))
      .map((a) => ({
        projectId: a.projectId,
        projectName: projectName.get(a.projectId) ?? a.projectId,
        revieweeId: a.assigneeId,
        revieweeName: person.get(a.assigneeId)!.name,
        revieweeRole: person.get(a.assigneeId)!.designation ?? person.get(a.assigneeId)!.role,
        period,
      }));

    // One pending entry per person per period, not one per project.
    const seen = new Set<string>();
    const unique = pending.filter((p) => {
      if (seen.has(p.revieweeId)) return false;
      seen.add(p.revieweeId);
      return true;
    });

    return { data: unique };
  });

  app.post("/reviews", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { revieweeId, rating, comment, period } = req.body as {
      revieweeId: string;
      rating: number;
      comment?: string;
      period: string;
    };

    if (!rating || rating < 1 || rating > 5) {
      return reply.code(400).send({ message: "rating (1-5) is required" });
    }

    if (!revieweeId) return reply.code(400).send({ message: "revieweeId is required" });
    if (revieweeId === req.user!.sub) {
      return reply.code(400).send({ message: "You cannot review yourself." });
    }

    const reviewee = await prisma.user.findUnique({ where: { id: revieweeId } });
    if (!reviewee) return reply.code(404).send({ message: "That person no longer exists." });

    const resolvedPeriod = period || String(new Date().getFullYear());
    const existing = await prisma.review.findFirst({
      where: { reviewerId: req.user!.sub, revieweeId, period: resolvedPeriod },
    });
    if (existing) {
      return reply.code(409).send({
        message: `You have already reviewed ${reviewee.name} for ${resolvedPeriod}.`,
      });
    }

    const review = await prisma.review.create({
      data: {
        reviewerId: req.user!.sub,
        revieweeId,
        rating,
        comment: comment ?? null,
        period: resolvedPeriod,
      },
    });

    return { data: { ...review, _id: review.id } };
  });

  app.get("/reviews/completed", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const items = await prisma.review.findMany({
      where: { reviewerId: req.user!.sub },
      orderBy: { createdAt: "desc" },
    });
    return { data: items };
  });
}
