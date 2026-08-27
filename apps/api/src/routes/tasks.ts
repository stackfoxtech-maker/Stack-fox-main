import type { FastifyInstance } from "fastify";
import { prisma } from "@stackfox/prisma";
import { requireAuth, requireRole } from "../plugins/auth";
import { isInternalRole } from "@stackfox/core";
import { ok, withId, paginated, pageParams } from "../lib/http";
import { emitEvent } from "../lib/events";

/**
 * Delivery tasks.
 *
 * Tasks are internal work items. Two things were wrong here: `PUT /tasks/:id`
 * checked only that the caller was signed in — so any client could edit any
 * task by id — and `POST /tasks` let a client create work assigned to staff.
 * Both are now staff-only, and editing is limited to the assignee or a lead.
 *
 * `GET /tasks/workload` exists because the team Resources heatmap was computing
 * capacity from `/tasks/my` — the viewer's own tasks — and then attributing
 * that single number across every team member, so every figure was wrong.
 */

const STAFF_WRITE = ["ADMIN", "SUPER_ADMIN", "SENIOR_PM", "PM", "SE"];
const OPEN_STATUSES = ["backlog", "todo", "in-progress", "review"];

function serializeTask(t: any) {
  return {
    ...t,
    _id: t.id,
    project: t.project ? { id: t.project.id, projectNumber: t.project.id, name: t.project.name } : null,
  };
}

export async function taskRoutes(app: FastifyInstance) {
  app.get("/tasks/my", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const tasks = await prisma.task.findMany({
      where: { assigneeId: req.user!.sub },
      include: { project: true },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    });
    return { data: { tasks: tasks.map(serializeTask) } };
  });

  /** Team-wide board. Staff only — tasks describe internal delivery work. */
  app.get("/tasks", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (!isInternalRole(req.user!.role)) {
      return reply.code(403).send({ message: "Staff only." });
    }

    const q = req.query as Record<string, string>;
    const { page, limit, skip } = pageParams(q, 50, 200);

    const where: any = {};
    if (q.assigneeId) where.assigneeId = q.assigneeId;
    if (q.projectId) where.projectId = q.projectId;
    if (q.status && q.status !== "all") where.status = q.status;
    if (q.open === "true") where.status = { in: OPEN_STATUSES };

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: { project: true },
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
        skip,
        take: limit,
      }),
      prisma.task.count({ where }),
    ]);

    return paginated(tasks.map(serializeTask), total, page, limit);
  });

  /**
   * Capacity per staff member: open tasks, overdue count and a load percentage
   * relative to a configurable comfortable ceiling.
   */
  app.get("/tasks/workload", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (!isInternalRole(req.user!.role)) {
      return reply.code(403).send({ message: "Staff only." });
    }

    const capacity = Math.max(
      1,
      parseInt((req.query as Record<string, string>).capacity ?? "") ||
        Number(process.env.TASK_CAPACITY_PER_PERSON ?? 8),
    );

    const [staff, openTasks] = await Promise.all([
      prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, name: true, role: true, designation: true, skills: true },
      }),
      prisma.task.findMany({
        where: { status: { in: OPEN_STATUSES } },
        select: { assigneeId: true, status: true, priority: true, dueDate: true },
      }),
    ]);

    const internal = staff.filter((u) => isInternalRole(u.role));
    const now = new Date();

    const rows = internal
      .map((u) => {
        const mine = openTasks.filter((t) => t.assigneeId === u.id);
        const overdue = mine.filter((t) => t.dueDate && t.dueDate < now).length;
        const urgent = mine.filter((t) => t.priority === "urgent" || t.priority === "high").length;

        return {
          id: u.id,
          _id: u.id,
          name: u.name,
          role: u.designation ?? u.role,
          skills: u.skills,
          openTasks: mine.length,
          inProgress: mine.filter((t) => t.status === "in-progress").length,
          overdue,
          urgent,
          // Capped so the bar stays readable; `openTasks` carries the raw number.
          load: Math.min(200, Math.round((mine.length / capacity) * 100)),
        };
      })
      .sort((a, b) => b.load - a.load);

    return ok(rows, {
      capacity,
      totalOpenTasks: openTasks.length,
      unassigned: openTasks.filter((t) => !internal.some((u) => u.id === t.assigneeId)).length,
    });
  });

  app.post("/tasks", async (req, reply) => {
    if (!requireRole(req, reply, STAFF_WRITE)) return;
    const { title, description, assigneeId, projectId, priority, status, dueDate } =
      req.body as Record<string, string | undefined>;

    if (!title?.trim() || !assigneeId) {
      return reply.code(400).send({ message: "title and assigneeId are required" });
    }

    const assignee = await prisma.user.findUnique({ where: { id: assigneeId } });
    if (!assignee || !assignee.isActive) {
      return reply.code(404).send({ message: "That assignee is not available." });
    }
    if (!isInternalRole(assignee.role)) {
      return reply.code(400).send({ message: "Tasks can only be assigned to staff." });
    }

    if (projectId) {
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project) return reply.code(404).send({ message: "Project not found" });
    }

    const task = await prisma.task.create({
      data: {
        title: title.trim(),
        description: description ?? null,
        assigneeId,
        projectId: projectId ?? null,
        priority: priority ?? "medium",
        status: status ?? "todo",
        dueDate: dueDate ? new Date(dueDate) : null,
      },
      include: { project: true },
    });

    await prisma.notification.create({
      data: {
        userId: assigneeId,
        title: "New task assigned",
        body: task.title,
        link: "/app/team/tasks",
      },
    });

    await emitEvent({
      code: "TASK_ASSIGNED",
      payload: { taskId: task.id, assigneeId },
      actor: req.user!.sub,
      projectId: projectId ?? undefined,
    });

    return ok(serializeTask(task));
  });

  app.put("/tasks/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { id } = req.params as { id: string };

    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) return reply.code(404).send({ message: "Task not found" });

    // The assignee can move their own work; leads can edit anyone's. A client
    // has no business here at all.
    const isLead = STAFF_WRITE.includes(req.user!.role);
    if (!isLead && task.assigneeId !== req.user!.sub) {
      return reply.code(404).send({ message: "Task not found" });
    }

    const body = (req.body ?? {}) as Record<string, any>;
    const data: Record<string, unknown> = {};
    if (typeof body.status === "string") data.status = body.status;
    if (typeof body.priority === "string") data.priority = body.priority;
    if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim();
    if (typeof body.description === "string") data.description = body.description;
    if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;

    // Reassignment is a lead-only action.
    if (typeof body.assigneeId === "string" && body.assigneeId !== task.assigneeId) {
      if (!isLead) {
        return reply.code(403).send({ message: "Only a lead can reassign a task." });
      }
      const next = await prisma.user.findUnique({ where: { id: body.assigneeId } });
      if (!next || !isInternalRole(next.role)) {
        return reply.code(400).send({ message: "Tasks can only be assigned to staff." });
      }
      data.assigneeId = body.assigneeId;
    }

    if (Object.keys(data).length === 0) {
      return reply.code(400).send({ message: "No updatable fields were supplied." });
    }

    const updated = await prisma.task.update({
      where: { id },
      data,
      include: { project: true },
    });
    return ok(serializeTask(updated));
  });

  app.delete("/tasks/:id", async (req, reply) => {
    if (!requireRole(req, reply, STAFF_WRITE)) return;
    const { id } = req.params as { id: string };
    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) return reply.code(404).send({ message: "Task not found" });

    await prisma.task.delete({ where: { id } });
    return ok({ success: true, id });
  });
}
