import type { FastifyInstance } from "fastify";
import { prisma } from "@stackfox/prisma";
import { requireAuth } from "../plugins/auth";
import { emitEvent } from "../lib/events";
import * as ids from "../lib/id";
import { LIST_CAP, pageParams, paginated } from "../lib/http";
import { clientScope, clientWriteScope, projectIdsInScope } from "../lib/scope";
import { isInternalRole } from "@stackfox/core";
import { parseBody } from "../lib/validate";
import {
  CloseTicketSchema,
  CreateTicketSchema,
  ResolveTicketSchema,
  TicketMessageSchema,
} from "./crmSchemas";

/**
 * The ticket actions below belong to the team (acknowledge, resolve, reply). They only
 * checked "signed in", so any client could acknowledge, resolve or answer as "team" on
 * any ticket by id, falsifying the SLA timestamps.
 */
function requireStaff(req: any, reply: any): boolean {
  if (!requireAuth(req, reply)) return false;
  if (!isInternalRole(req.user.role)) {
    reply.code(403).send({ error: "Staff only." });
    return false;
  }
  return true;
}

function serializeTicket(t: any) {
  return {
    ...t,
    _id: t.id,
    ticketNumber: t.id,
    status: String(t.status ?? "OPEN").toLowerCase(),
    client: { _id: t.raisedBy },
    replies: (t.replies ?? []).map((r: any) => ({
      _id: r.id,
      message: r.message,
      createdAt: r.createdAt,
      sender: { _id: r.senderId, name: r.senderName, role: r.senderRole },
    })),
  };
}

export async function ticketRoutes(app: FastifyInstance) {
  // Client-facing support desk — mounted at /support. The same Ticket model
  // also backs the PM-side P1-P4 bug tracker further below at /tickets.
  app.post("/support", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const body = parseBody(req, reply, CreateTicketSchema);
    if (!body) return;

    // Attach the ticket to its project (and engagement) so the PM tracker, SLA reports
    // and the client's ticket report can find it; the project id was accepted and dropped.
    let projectId: string | null = null;
    let engagementId: string | null = null;
    if (body.projectId) {
      const scope = await clientScope(req, reply);
      if (scope === undefined) return;
      const project = await prisma.project.findFirst({
        where: {
          id: body.projectId,
          ...(scope !== null ? { engagement: { clientId: scope } } : {}),
        },
        select: { id: true, engagementId: true },
      });
      if (!project) return reply.code(404).send({ error: "Project not found" });
      projectId = project.id;
      engagementId = project.engagementId;
    }

    const ticket = await prisma.ticket.create({
      data: {
        id: ids.ticketId(),
        raisedBy: req.user!.sub,
        projectId,
        engagementId,
        subject: body.subject,
        description: body.description,
        category: body.category ?? "general",
        priority: body.priority ?? "medium",
        status: "OPEN",
      },
    });

    await emitEvent({
      code: "TICKET_RAISED",
      payload: {
        ticketId: ticket.id,
        category: ticket.category,
        priority: ticket.priority,
      },
      actor: req.user!.sub,
    });

    return { data: serializeTicket(ticket) };
  });

  app.get("/support", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const tickets = await prisma.ticket.findMany({
      take: LIST_CAP,
      where: { raisedBy: req.user!.sub },
      include: { replies: { orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "desc" },
    });
    return { data: tickets.map(serializeTicket) };
  });

  app.get("/support/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { id } = req.params as { id: string };
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: { replies: { orderBy: { createdAt: "asc" } } },
    });
    if (!ticket || ticket.raisedBy !== req.user!.sub) {
      return reply.code(404).send({ message: "Ticket not found" });
    }
    return { data: { ticket: serializeTicket(ticket) } };
  });

  app.post("/support/:id/reply", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { id } = req.params as { id: string };
    const msgBody = parseBody(req, reply, TicketMessageSchema);
    if (!msgBody) return;
    const { message } = msgBody;

    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket || ticket.raisedBy !== req.user!.sub) {
      return reply.code(404).send({ message: "Ticket not found" });
    }

    await prisma.ticketReply.create({
      data: {
        ticketId: id,
        senderId: req.user!.sub,
        senderName: req.user!.email,
        senderRole: "client",
        message: message.trim(),
      },
    });

    if (ticket.status === "RESOLVED" || ticket.status === "CLOSED") {
      await prisma.ticket.update({ where: { id }, data: { status: "REOPENED" } });
    }

    await emitEvent({
      code: "TICKET_REPLY_ADDED",
      payload: { ticketId: id },
      actor: req.user!.sub,
    });

    return { data: { success: true } };
  });

  // ── PM-side bug tracker (G7): P1-P4 severity, SLA, escalation ──────────
  app.get("/tickets", async (req, reply) => {
    const scope = await clientScope(req, reply);
    if (scope === undefined) return;

    const q = req.query as Record<string, string>;
    const { page, limit, skip } = pageParams(q);
    const where: any = {};

    // Tickets hang off a project, so a client only ever sees tickets on their
    // own projects. Without this the PM bug tracker leaked every client's
    // defects to every other client.
    if (scope !== null) {
      const allowed = await projectIdsInScope(scope);
      if (q.projectId && !allowed!.includes(q.projectId))
        return paginated([], 0, page, limit);
      where.projectId = { in: q.projectId ? [q.projectId] : allowed! };
    } else if (q.projectId) {
      where.projectId = q.projectId;
    }

    if (q.status) where.status = q.status;
    if (q.severity) where.severity = q.severity;

    const [items, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.ticket.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  });

  app.get("/tickets/:id", async (req, reply) => {
    const scope = await clientScope(req, reply);
    if (scope === undefined) return;

    const { id } = req.params as { id: string };
    if (scope !== null) {
      const owned = await prisma.ticket.findFirst({
        where: { id, project: { engagement: { clientId: scope } } },
        select: { id: true },
      });
      if (!owned) return reply.code(404).send({ error: "Ticket not found" });
    }
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: { replies: true },
    });
    if (!ticket) return reply.code(404).send({ error: "Ticket not found" });
    return ticket;
  });

  app.patch("/tickets/:id/acknowledge", async (req, reply) => {
    if (!requireStaff(req, reply)) return;
    const { id } = req.params as { id: string };
    if (!(await prisma.ticket.findUnique({ where: { id }, select: { id: true } })))
      return reply.code(404).send({ error: "Ticket not found" });
    const updated = await prisma.ticket.update({
      where: { id },
      data: { status: "ACKNOWLEDGED", acknowledgedAt: new Date() },
    });
    await emitEvent({
      code: "TICKET_ACKNOWLEDGED",
      payload: { ticketId: id },
      actor: req.user!.sub,
    });
    return updated;
  });

  app.patch("/tickets/:id/resolve", async (req, reply) => {
    if (!requireStaff(req, reply)) return;
    const { id } = req.params as { id: string };
    const resBody = parseBody(req, reply, ResolveTicketSchema);
    if (!resBody) return;
    const { resolution } = resBody;
    if (!(await prisma.ticket.findUnique({ where: { id }, select: { id: true } })))
      return reply.code(404).send({ error: "Ticket not found" });
    const updated = await prisma.ticket.update({
      where: { id },
      data: { status: "RESOLVED", resolution, resolvedAt: new Date() },
    });
    await emitEvent({
      code: "TICKET_RESOLVED",
      payload: { ticketId: id },
      actor: req.user!.sub,
    });
    return updated;
  });

  app.patch("/tickets/:id/verify", async (req, reply) => {
    // The client confirms (or reopens) a resolved ticket: only for tickets on their
    // own projects. Staff may also do it.
    const scope = await clientWriteScope(req, reply);
    if (scope === undefined) return;
    const { id } = req.params as { id: string };
    const closeBody = parseBody(req, reply, CloseTicketSchema);
    if (!closeBody) return;
    const { accepted } = closeBody;
    const target = await prisma.ticket.findUnique({
      where: { id },
      select: { projectId: true, raisedBy: true },
    });
    if (!target) return reply.code(404).send({ error: "Ticket not found" });
    if (scope !== null) {
      const own = target.raisedBy === req.user!.sub;
      const allowed = (await projectIdsInScope(scope)) ?? [];
      if (!own && !(target.projectId && allowed.includes(target.projectId)))
        return reply.code(404).send({ error: "Ticket not found" });
    }

    if (accepted) {
      const updated = await prisma.ticket.update({
        where: { id },
        data: { status: "CLOSED", closedAt: new Date() },
      });
      await emitEvent({
        code: "TICKET_CLOSED",
        payload: { ticketId: id },
        actor: req.user!.sub,
      });
      return updated;
    }

    const updated = await prisma.ticket.update({
      where: { id },
      data: { status: "REOPENED" },
    });
    await emitEvent({
      code: "TICKET_REOPENED",
      payload: { ticketId: id },
      actor: req.user!.sub,
    });
    return updated;
  });

  // Team-side reply into a client's ticket (shows up in their Support view)
  app.post("/tickets/:id/reply", async (req, reply) => {
    if (!requireStaff(req, reply)) return;
    const { id } = req.params as { id: string };
    const replyBody = parseBody(req, reply, TicketMessageSchema);
    if (!replyBody) return;
    const { message } = replyBody;

    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) return reply.code(404).send({ error: "Ticket not found" });

    await prisma.ticketReply.create({
      data: {
        ticketId: id,
        senderId: req.user!.sub,
        senderName: req.user!.email,
        senderRole: "team",
        message: message.trim(),
      },
    });

    if (ticket.status === "OPEN") {
      await prisma.ticket.update({
        where: { id },
        data: { status: "ACKNOWLEDGED", acknowledgedAt: new Date() },
      });
    }

    await emitEvent({
      code: "TICKET_REPLY_ADDED",
      payload: { ticketId: id },
      actor: req.user!.sub,
    });

    return { success: true };
  });
}
