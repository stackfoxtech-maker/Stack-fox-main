import { createWorker, QUEUE } from "../lib/queue";
import { prisma } from "@stackfox/prisma";
import { flushBusinessMail } from "../lib/businessMail";

interface NotifyJob {
  code: string;
  payload?: Record<string, unknown>;
  engagementId?: string;
  projectId?: string;
  /** Notify these users directly, in addition to any engagement/project subscribers. */
  userIds?: string[];
}

/**
 * Writes the in-app notification inbox. `NotificationContent` is the *template*
 * table (keyed `{event_code}.{channel}`); the per-user inbox is `Notification`.
 * Templates are looked up when present so copy can be edited by admins without
 * a deploy, and fall back to a humanised event code.
 */
/**
 * Events that staff, not just the client, have to act on. The inbox below only
 * ever reached the client's own users, so a PM never learned a milestone was
 * waiting for review, and finance never learned a client had asked to pay cash.
 */
const PM_ROLES = ["ADMIN", "SENIOR_PM", "PM"];
const FINANCE_ROLES = ["ADMIN", "FINANCE"];

interface StaffAlert {
  title: string;
  /** Roles that receive it. For project alerts the project's own PM is preferred. */
  roles: string[];
  /** Only some payloads matter (a status change is only urgent for cash requests). */
  when?: (payload?: Record<string, unknown>) => boolean;
  link: (role: string, projectId?: string) => string;
}

const projectLink = (role: string, projectId?: string) =>
  role === "ADMIN"
    ? `/app/admin/projects${projectId ? `/${projectId}` : ""}`
    : `/app/team/projects${projectId ? `/${projectId}` : ""}`;
const ordersLink = (role: string) =>
  role === "ADMIN" ? "/app/admin/orders" : "/app/team/orders";

const STAFF_ALERTS: Record<string, StaffAlert> = {
  PROJECT_PROVISIONED: {
    title: "New project needs a PM",
    roles: ["ADMIN", "SENIOR_PM"],
    link: projectLink,
  },
  MILESTONE_SUBMITTED: {
    title: "Milestone ready for review",
    roles: PM_ROLES,
    link: projectLink,
  },
  CR_SUBMITTED: { title: "New change request", roles: PM_ROLES, link: projectLink },
  HANDOVER_DISPUTED: { title: "Handover disputed", roles: PM_ROLES, link: projectLink },
  HANDOVER_ACCEPTED: { title: "Handover accepted", roles: PM_ROLES, link: projectLink },
  QUOTE_STATUS_CHANGED: {
    title: "Cash payment requested",
    roles: FINANCE_ROLES,
    when: (p) => p?.status === "awaiting_cash",
    link: ordersLink,
  },
  PAYMENT_NEEDS_REVIEW: {
    title: "A payment needs review",
    roles: FINANCE_ROLES,
    link: ordersLink,
  },
};

async function notifyStaff(
  code: string,
  payload: Record<string, unknown> | undefined,
  projectId: string | undefined,
) {
  const alert = STAFF_ALERTS[code];
  if (!alert || (alert.when && !alert.when(payload))) return;

  // A project that already has a PM goes to that person alone.
  let recipients: { id: string; role: string }[] = [];
  if (projectId && alert.roles === PM_ROLES) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { pmUserId: true },
    });
    if (project?.pmUserId) {
      recipients = await prisma.user.findMany({
        where: { id: project.pmUserId, isActive: true },
        select: { id: true, role: true },
      });
    }
  }
  if (recipients.length === 0) {
    recipients = await prisma.user.findMany({
      where: { isActive: true, role: { in: alert.roles } },
      select: { id: true, role: true },
    });
  }

  for (const user of recipients) {
    await prisma.notification.create({
      data: {
        userId: user.id,
        title: alert.title,
        body: renderBody(code, payload),
        link: alert.link(user.role, projectId),
      },
    });
  }
}

createWorker<NotifyJob>(QUEUE.notifications, async (job) => {
  const { code, payload, engagementId, projectId, userIds } = job.data;
  if (code.startsWith("INVOICE_")) await flushBusinessMail();

  await notifyStaff(code, payload, projectId);

  const subscribers = Array.from(
    new Set([...(await getSubscribers(engagementId, projectId)), ...(userIds ?? [])]),
  );
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

async function getSubscribers(
  engagementId?: string,
  projectId?: string,
): Promise<string[]> {
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
  return code
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}

function renderBody(code: string, payload?: Record<string, unknown>): string {
  if (!payload || Object.keys(payload).length === 0) return formatTitle(code);
  return (
    Object.entries(payload)
      .filter(([, v]) => v !== null && v !== undefined && typeof v !== "object")
      .map(([k, v]) => `${k}: ${v}`)
      .join(" · ") || formatTitle(code)
  );
}

function resolveLink(
  tpl?: string | null,
  projectId?: string,
  engagementId?: string,
): string | null {
  if (projectId) return `/app/client/projects/${projectId}`;
  if (engagementId) return `/app/client/engagements`;
  return tpl ?? null;
}
