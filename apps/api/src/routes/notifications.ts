import type { FastifyInstance } from "fastify";
import { prisma } from "@stackfox/prisma";
import { requireAuth } from "../plugins/auth";

// Per-user notification inbox — distinct from NotificationContent (admin
// templates keyed by event_code.channel, no userId/readAt on that model).
export async function notificationRoutes(app: FastifyInstance) {
  app.get("/notifications", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { unread, page = "1", limit = "30" } = req.query as Record<string, string>;
    const where: any = { userId: req.user!.sub };
    if (unread === "true") where.readAt = null;

    const [items, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
        orderBy: { createdAt: "desc" },
      }),
      prisma.notification.count({ where }),
    ]);
    return {
      data: items,
      total,
      unread: await prisma.notification.count({ where: { userId: req.user!.sub, readAt: null } }),
    };
  });

  app.put("/notifications/:id/read", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { id } = req.params as { id: string };
    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification || notification.userId !== req.user!.sub) {
      return reply.code(404).send({ message: "Notification not found" });
    }
    return prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  });

  app.patch("/notifications/read", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { ids } = req.body as { ids: string[] };
    await prisma.notification.updateMany({
      where: { id: { in: ids }, userId: req.user!.sub },
      data: { readAt: new Date() },
    });
    return { success: true };
  });

  app.get("/notifications/preferences", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const user = await prisma.user.findUnique({
      where: { id: req.user!.sub },
      select: { notificationPrefs: true },
    });
    return user?.notificationPrefs ?? {};
  });

  app.patch("/notifications/preferences", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const prefs = req.body as any;
    await prisma.user.update({
      where: { id: req.user!.sub },
      data: { notificationPrefs: prefs },
    });
    return { success: true };
  });
}
