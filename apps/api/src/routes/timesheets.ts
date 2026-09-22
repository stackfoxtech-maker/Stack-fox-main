import type { FastifyInstance } from "fastify";
import { prisma } from "@stackfox/prisma";
import { requireAuth } from "../plugins/auth";
import { emitEvent } from "../lib/events";
import { clientScope } from "../lib/scope";
import { LIST_CAP, ok, withId, withIds } from "../lib/http";
import { parseBody } from "../lib/validate";
import { QueryTimesheetLineSchema, ResolveTimesheetLineSchema } from "./opsSchemas";

export async function timesheetRoutes(app: FastifyInstance) {
  app.get("/timesheets", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { engId } = req.query as { engId?: string };

    const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
    const userEngagements = await prisma.engagement.findMany({
      take: LIST_CAP,
      where: { clientId: user?.orgId || undefined },
      select: { id: true },
    });
    const allowedEngIds = userEngagements.map((e) => e.id);

    const where: any = {};
    if (engId) {
      if (!allowedEngIds.includes(engId)) {
        return reply.code(403).send({ error: "Access denied to this engagement" });
      }
      where.engagementId = engId;
    } else if (allowedEngIds.length > 0) {
      where.engagementId = { in: allowedEngIds };
    } else {
      where.engagementId = "__none__";
    }

    const items = await prisma.timesheet.findMany({
      take: LIST_CAP,
      where,
      include: { lines: true },
      orderBy: { weekStart: "desc" },
    });
    return ok(withIds(items));
  });

  app.get("/timesheets/:id", async (req, reply) => {
    const scope = await clientScope(req, reply);
    if (scope === undefined) return;

    const { id } = req.params as { id: string };
    const ts = await prisma.timesheet.findFirst({
      where: { id, ...(scope !== null ? { engagement: { clientId: scope } } : {}) },
      include: { lines: true },
    });
    if (!ts) return reply.code(404).send({ error: "Timesheet not found" });
    return ok(withId(ts));
  });

  app.post("/timesheets/:id/approve-all", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { id } = req.params as { id: string };

    await prisma.timesheetLine.updateMany({
      where: { timesheetId: id, status: "PENDING" },
      data: { status: "APPROVED", locked: true },
    });

    const updated = await prisma.timesheet.update({
      where: { id },
      data: { status: "APPROVED", resolvedAt: new Date() },
    });

    const ts = await prisma.timesheet.findUnique({ where: { id } });
    await emitEvent({
      code: "TSHEET_APPROVED",
      payload: { timesheetId: id },
      actor: req.user!.sub,
      engagementId: ts?.engagementId,
    });

    return updated;
  });

  app.post("/timesheets/:id/query-line", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { id } = req.params as { id: string };
    const qBody = parseBody(req, reply, QueryTimesheetLineSchema);
    if (!qBody) return;
    const { lineId, note } = qBody;

    await prisma.timesheetLine.update({
      where: { id: lineId },
      data: { status: "QUERIED", queryNote: note },
    });

    await prisma.timesheet.update({
      where: { id },
      data: { status: "PARTIAL" },
    });

    return { success: true };
  });

  app.post("/timesheets/:id/resolve-line", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const rBody = parseBody(req, reply, ResolveTimesheetLineSchema);
    if (!rBody) return;
    const { lineId } = rBody;

    await prisma.timesheetLine.update({
      where: { id: lineId },
      data: { status: "APPROVED", locked: true, queryNote: null },
    });

    return { success: true };
  });
}
