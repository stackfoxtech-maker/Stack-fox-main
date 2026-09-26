import type { FastifyInstance } from "fastify";
import { prisma } from "@stackfox/prisma";
import { requireAuth } from "../plugins/auth";
import { emitEvent } from "../lib/events";
import { isInternalRole } from "@stackfox/core";
import { toJson } from "../lib/json";
import { clientScope, resolveOrgId } from "../lib/scope";
import { LIST_CAP } from "../lib/http";
import { parseBody } from "../lib/validate";
import {
  SendMessageSchema,
  StartConversationSchema,
  StartTeamConversationSchema,
} from "./opsSchemas";

/**
 * Client <-> StackFox messaging.
 *
 * Threads are authorised purely by membership of `participantIds`. Two things
 * are enforced beyond that:
 *
 *  - a client may only open a thread with internal staff, or with a member of
 *    their own Org. Previously any signed-in user could start a thread with any
 *    user id, which let one client message another and learn their name and role.
 *  - unread state is tracked per participant in `readReceipts`, so the portal
 *    can show a real badge instead of re-counting every message on each render.
 */

async function participantsFor(ids: string[]) {
  const users = await prisma.user.findMany({
    take: LIST_CAP,
    where: { id: { in: ids } },
    select: { id: true, name: true, role: true },
  });
  return users.map((u) => ({ ...u, _id: u.id }));
}

type Receipts = Record<string, string>;

function readReceiptsOf(convo: { readReceipts: unknown }): Receipts {
  return (convo.readReceipts as Receipts | null) ?? {};
}

async function findOrCreateDirect(
  me: string,
  otherId: string,
  title?: string,
  projectId?: string,
) {
  const existing = await prisma.conversation.findFirst({
    where: { participantIds: { hasEvery: [me, otherId] } },
  });
  if (existing) return { ...existing, _id: existing.id };
  const convo = await prisma.conversation.create({
    data: {
      title,
      projectId: projectId ?? null,
      participantIds: [me, otherId],
      lastMessageAt: new Date(),
    },
  });
  return { ...convo, _id: convo.id };
}

export async function messageRoutes(app: FastifyInstance) {
  // List conversations the current user is part of, newest activity first.
  app.get("/messages/conversations", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const me = req.user!.sub;

    const convos = await prisma.conversation.findMany({
      where: { participantIds: { has: me } },
      include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
      orderBy: { lastMessageAt: "desc" },
    });

    const conversations = await Promise.all(
      convos.map(async (c) => {
        const lastReadAt = readReceiptsOf(c)[me];
        const unreadCount = await prisma.message.count({
          where: {
            conversationId: c.id,
            senderId: { not: me },
            ...(lastReadAt ? { createdAt: { gt: new Date(lastReadAt) } } : {}),
          },
        });

        return {
          ...c,
          _id: c.id,
          participants: await participantsFor(c.participantIds),
          lastMessage: c.messages[0]
            ? { text: c.messages[0].text, createdAt: c.messages[0].createdAt }
            : null,
          unreadCount,
        };
      }),
    );

    return {
      data: { conversations },
      meta: { totalUnread: conversations.reduce((n, c) => n + c.unreadCount, 0) },
    };
  });

  // Start (or reuse) a direct conversation.
  app.post("/messages/start", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const me = req.user!.sub;
    const convBody = parseBody(req, reply, StartConversationSchema);
    if (!convBody) return;
    const { userId, title, projectId } = convBody;
    if (userId === me)
      return reply.code(400).send({ message: "You cannot message yourself" });

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, orgId: true, role: true, isActive: true },
    });
    if (!target || !target.isActive) {
      return reply
        .code(404)
        .send({ message: "That person is not available to message." });
    }

    // Clients may reach StackFox staff, or colleagues inside their own Org —
    // never another tenant.
    if (!isInternalRole(req.user!.role)) {
      const myOrg = await resolveOrgId(req);
      const allowed =
        isInternalRole(target.role) || (myOrg !== null && target.orgId === myOrg);
      if (!allowed) {
        return reply
          .code(403)
          .send({ message: "You can only message your StackFox team." });
      }
    }

    return { data: await findOrCreateDirect(me, userId, title, projectId) };
  });

  // A client cannot see the staff directory, so it cannot choose a recipient.
  // This starts a conversation with the person who owns the project: its PM,
  // or an administrator when none is assigned. Staff callers should use
  // /messages/start with a chosen user instead.
  app.post("/messages/start-team", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (isInternalRole(req.user!.role)) {
      return reply
        .code(400)
        .send({ message: "Staff choose a recipient with /messages/start." });
    }
    const body = parseBody(req, reply, StartTeamConversationSchema);
    if (!body) return;
    const scope = await clientScope(req, reply);
    if (scope === undefined) return;

    // The client's own projects only; the newest one when none is named.
    const project = await prisma.project.findFirst({
      where: {
        ...(body.projectId ? { id: body.projectId } : {}),
        engagement: { clientId: scope as string },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, pmUserId: true },
    });
    if (body.projectId && !project) {
      return reply.code(404).send({ message: "Project not found" });
    }

    let recipientId: string | null = null;
    if (project?.pmUserId) {
      const pm = await prisma.user.findUnique({
        where: { id: project.pmUserId },
        select: { id: true, isActive: true, role: true },
      });
      if (pm?.isActive && isInternalRole(pm.role)) recipientId = pm.id;
    }
    if (!recipientId) {
      const admin = await prisma.user.findFirst({
        where: { role: "ADMIN", isActive: true },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      recipientId = admin?.id ?? null;
    }
    if (!recipientId) {
      return reply
        .code(503)
        .send({ message: "No one is available to message right now." });
    }

    return {
      data: await findOrCreateDirect(
        req.user!.sub,
        recipientId,
        project ? `Your project: ${project.name}` : "Message your StackFox team",
        project?.id,
      ),
    };
  });

  // Messages within a conversation. Opening it marks it read for this user.
  app.get("/messages/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const me = req.user!.sub;
    const { id } = req.params as { id: string };

    const convo = await prisma.conversation.findUnique({ where: { id } });
    if (!convo || !convo.participantIds.includes(me)) {
      return reply.code(404).send({ message: "Conversation not found" });
    }

    const messages = await prisma.message.findMany({
      take: LIST_CAP,
      where: { conversationId: id },
      orderBy: { createdAt: "asc" },
    });
    const senderMap = new Map(
      (await participantsFor(convo.participantIds)).map((p) => [p.id, p]),
    );

    await prisma.conversation.update({
      where: { id },
      data: {
        readReceipts: toJson({
          ...readReceiptsOf(convo),
          [me]: new Date().toISOString(),
        }),
      },
    });

    return {
      data: messages.map((m) => ({
        ...m,
        _id: m.id,
        isMine: m.senderId === me,
        sender: senderMap.get(m.senderId) ?? { _id: m.senderId, name: "Unknown" },
      })),
    };
  });

  app.post("/messages/send", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const me = req.user!.sub;
    const sendBody = parseBody(req, reply, SendMessageSchema);
    if (!sendBody) return;
    const { conversationId, text } = sendBody;
    if (text.length > 10000) {
      return reply
        .code(400)
        .send({ message: "Message is too long (10,000 character limit)." });
    }

    const convo = await prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!convo || !convo.participantIds.includes(me)) {
      return reply.code(404).send({ message: "Conversation not found" });
    }

    const now = new Date();
    const [message] = await prisma.$transaction([
      prisma.message.create({
        data: { conversationId, senderId: me, text: text.trim() },
      }),
      // Bump recency and mark read for the sender in the same transaction, so a
      // thread can never sort stale relative to its own newest message.
      prisma.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessageAt: now,
          readReceipts: toJson({ ...readReceiptsOf(convo), [me]: now.toISOString() }),
        },
      }),
    ]);

    // Notify the other participants through the standard in-app inbox.
    for (const recipient of convo.participantIds.filter((p) => p !== me)) {
      await prisma.notification.create({
        data: {
          userId: recipient,
          title: "New message",
          body: text.trim().slice(0, 140),
          link: `/app/client/messages?c=${conversationId}`,
        },
      });
    }

    await emitEvent({ code: "MESSAGE_SENT", payload: { conversationId }, actor: me });

    return { data: { ...message, _id: message.id, isMine: true } };
  });

  /** Explicit read marker, for clients that mark read without refetching. */
  app.post("/messages/:id/read", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const me = req.user!.sub;
    const { id } = req.params as { id: string };

    const convo = await prisma.conversation.findUnique({ where: { id } });
    if (!convo || !convo.participantIds.includes(me)) {
      return reply.code(404).send({ message: "Conversation not found" });
    }

    await prisma.conversation.update({
      where: { id },
      data: {
        readReceipts: toJson({
          ...readReceiptsOf(convo),
          [me]: new Date().toISOString(),
        }),
      },
    });
    return { data: { success: true } };
  });
}
