import { createWorker, QUEUE } from "../lib/queue";
import { prisma } from "@stackfox/prisma";

interface NotifyJob {
  code: string;
  payload?: Record<string, unknown>;
  engagementId?: string;
  projectId?: string;
}

/**
 * Writes the in-app notification inbox. `NotificationContent` is the *template*
 * table (keyed `{event_code}.{channel}`); the per-user inbox is `Notification`.
 * Templates are looked up when present so copy can be edited by admins without
 * a deploy, and fall back to a humanised event code.
 */
createWorker<NotifyJob>(QUEUE.notifications, async (job) => {
  const { code, payload, engagementId, projectId } = job.data;

  const subscribers = await getSubscribers(engagementId, projectId);
  if (subscribers.length === 0) return;

  const template = await prisma.notificationContent
    .findUnique({ where: { key: `${code}.IN_APP` } })
    .catch(() => null);

  for (const userId of subscribers) {
    const prefs = await getUserPrefs(userId);
    const channels = resolveChannels(code, prefs);
    if (!channels.includes("in_app")) continue;

    await prisma.notification.create({
      data: {
        userId,
        title: template?.subject ?? formatTitle(code),
        body: template?.body ?? renderBody(code, payload),
        link: resolveLink(template?.ctaUrlTpl, projectId, engagementId),
      },
    });
  }
});

async function getSubscribers(engagementId?: string, projectId?: string): Promise<string[]> {
  const userIds = new Set<string>();

  if (engagementId) {
    const eng = await prisma.engagement.findUnique({
      where: { id: engagementId },
      include: { client: { include: { users: true } } },
    });
    eng?.client.users.forEach((u) => userIds.add(u.id));
  }

  if (projectId) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { engagement: { include: { client: { include: { users: true } } } } },
    });
    project?.engagement.client.users.forEach((u) => userIds.add(u.id));
  }

  return Array.from(userIds);
}

async function getUserPrefs(userId: string): Promise<Record<string, any>> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { notificationPrefs: true },
  });
  return (user?.notificationPrefs as Record<string, any>) ?? {};
}

function resolveChannels(code: string, prefs: Record<string, any>): string[] {
  if (prefs[code]?.channels) return prefs[code].channels;
  return ["in_app"];
}

function formatTitle(code: string): string {
  return code.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

function renderBody(code: string, payload?: Record<string, unknown>): string {
  if (!payload || Object.keys(payload).length === 0) return formatTitle(code);
  return Object.entries(payload)
    .filter(([, v]) => v !== null && v !== undefined && typeof v !== "object")
    .map(([k, v]) => `${k}: ${v}`)
    .join(" · ") || formatTitle(code);
}

function resolveLink(tpl?: string | null, projectId?: string, engagementId?: string): string | null {
  if (projectId) return `/app/client/projects/${projectId}`;
  if (engagementId) return `/app/client/engagements`;
  return tpl ?? null;
}
