import type { FastifyInstance } from "fastify";
import { prisma } from "@stackfox/prisma";
import { requireAuth } from "../plugins/auth";
import { emitEvent } from "../lib/events";
import { isInternalRole } from "@stackfox/core";
import { toJson } from "../lib/json";
import { resolveOrgId } from "../lib/scope";

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
    where: { id: { in: ids } },
    select: { id: true, name: true, role: true },
  });
  return users.map((u) => ({ ...u, _id: u.id }));
}

type Receipts = Record<string, string>;

function readReceiptsOf(convo: { readReceipts: unknown }): Receipts {
  return (convo.readReceipts as Receipts | null) ?? {};
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
    const { userId, title, projectId } = req.body as {
      userId?: string;
      title?: string;
      projectId?: string;
    };
    if (!userId) return reply.code(400).send({ message: "userId is required" });
    if (userId === me) return reply.code(400).send({ message: "You cannot message yourself" });

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, orgId: true, role: true, isActive: true },
    });
    if (!target || !target.isActive) {
      return reply.code(404).send({ message: "That person is not available to message." });
    }

    // Clients may reach StackFox staff, or colleagues inside their own Org —
    // never another tenant.
    if (!isInternalRole(req.user!.role)) {
      const myOrg = await resolveOrgId(req);
      const allowed = isInternalRole(target.role) || (myOrg !== null && target.orgId === myOrg);
      if (!allowed) {
        return reply.code(403).send({ message: "You can only message your StackFox team." });
      }
    }

    const existing = await prisma.conversation.findFirst({
      where: { participantIds: { hasEvery: [me, userId] } },
    });
    if (existing) return { data: { ...existing, _id: existing.id } };

    const convo = await prisma.conversation.create({
      data: {
        title,
        projectId: projectId ?? null,
        participantIds: [me, userId],
        lastMessageAt: new Date(),
      },
    });
    return { data: { ...convo, _id: convo.id } };
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
      where: { conversationId: id },
      orderBy: { createdAt: "asc" },
    });
    const senderMap = new Map((await participantsFor(convo.participantIds)).map((p) => [p.id, p]));

    await prisma.conversation.update({
      where: { id },
      data: {
        readReceipts: toJson({ ...readReceiptsOf(convo), [me]: new Date().toISOString() }),
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
    const { conversationId, text } = req.body as { conversationId?: string; text?: string };
    if (!conversationId || !text?.trim()) {
      return reply.code(400).send({ message: "conversationId and text are required" });
    }
    if (text.length > 10000) {
      return reply.code(400).send({ message: "Message is too long (10,000 character limit)." });
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
      data: { readReceipts: toJson({ ...readReceiptsOf(convo), [me]: new Date().toISOString() }) },
    });
    return { data: { success: true } };
  });
}
