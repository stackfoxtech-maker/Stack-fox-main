import type { FastifyInstance } from "fastify";
import { prisma } from "@stackfox/prisma";
import { clientScope } from "../lib/scope";
import { paginated, pageParams } from "../lib/http";

export async function eventRoutes(app: FastifyInstance) {
  app.get("/events", async (req, reply) => {
    const scope = await clientScope(req, reply);
    if (scope === undefined) return;

    const { engId, projectId, code, page = "1", limit = "50" } = req.query as Record<string, string>;
    const where: any = {};

    // The activity feed is the most sensitive read in the portal: events carry
    // payloads from every tenant. Restrict to the caller's own engagements and
    // projects, and drop rows that belong to neither.
    if (scope !== null) {
      const engagements = await prisma.engagement.findMany({
        where: { clientId: scope },
        select: { id: true, projects: { select: { id: true } } },
      });
      const engIds = engagements.map((e) => e.id);
      const projIds = engagements.flatMap((e) => e.projects.map((p) => p.id));

      if (engId && !engIds.includes(engId)) return paginated([], 0, 1, 50);
      if (projectId && !projIds.includes(projectId)) return paginated([], 0, 1, 50);

      where.OR = [
        { engagementId: { in: engId ? [engId] : engIds } },
        { projectId: { in: projectId ? [projectId] : projIds } },
      ];
    } else {
      if (engId) where.engagementId = engId;
      if (projectId) where.projectId = projectId;
    }

    if (code) where.code = code;

    const { page: p, limit: l, skip } = pageParams({ page, limit }, 50, 200);
    const [rows, total] = await Promise.all([
      prisma.event.findMany({ where, skip, take: l, orderBy: { createdAt: "desc" } }),
      prisma.event.count({ where }),
    ]);

    // `Event.seq` is a BigInt primary key, which JSON cannot serialise — it
    // throws "Do not know how to serialize a BigInt" on the way out. Narrow it
    // to a string and expose it as the row id the client keys on.
    const items = rows.map((e) => ({
      ...e,
      seq: e.seq.toString(),
      id: e.seq.toString(),
    }));

    return paginated(items, total, p, l);
  });
}
