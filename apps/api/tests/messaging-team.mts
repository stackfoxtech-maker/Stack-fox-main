/**
 * A client can start a conversation with their project team.
 *
 * No screen could start a conversation and clients cannot list staff, so the
 * messaging feature was unreachable from the UI. POST /messages/start-team
 * resolves the recipient server side: the project's PM, or an administrator.
 *
 *   pnpm --filter @stackfox/api exec tsx tests/messaging-team.mts
 */
import "../src/env";
import { prisma } from "@stackfox/prisma";
import * as ids from "../src/lib/id";

const BASE = process.env.TEST_API_URL ?? "http://localhost:4000";
const stamp = Date.now();
const checks: Array<[string, boolean]> = [];
const check = (label: string, pass: boolean) => checks.push([label, pass]);

async function call(method: string, path: string, token: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { s: res.status, b: (await res.json().catch(() => null)) as any };
}
async function actor(tag: string, role?: string) {
  const email = `msg-${tag}-${stamp}@example.com`;
  const r = await fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: `Msg ${tag}`, email, password: "MessagePass123!ok" }),
  });
  const reg = (await r.json()) as any;
  if (role) await prisma.user.update({ where: { email }, data: { role, orgId: null } });
  const l = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "MessagePass123!ok" }),
  });
  const d = ((await l.json()) as any).data;
  return {
    token: d.accessToken as string,
    id: reg.data.user.id as string,
    orgId: reg.data.user.orgId as string,
  };
}

const clientA = await actor("a");
const clientB = await actor("b");
const pm = await actor("pm", "PM");
const admin = await actor("admin", "ADMIN");

const svc = await prisma.serviceUnit.findFirst({ where: { status: "PUBLISHED" } });
const mkProject = async (clientId: string, name: string, pmUserId?: string) => {
  const eng = await prisma.engagement.create({
    data: {
      id: ids.engagementId(),
      clientId,
      model: "FPM",
      commercial: {},
      status: "ACTIVE",
    },
  });
  return prisma.project.create({
    data: {
      id: `SF-MSG-${stamp}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      engagementId: eng.id,
      serviceId: svc!.id,
      configSnapshot: {},
      status: "ACTIVE",
      pmUserId: pmUserId ?? null,
    },
  });
};
const withPm = await mkProject(clientA.orgId, "Has a PM", pm.id);

const a = await call("POST", "/messages/start-team", clientA.token, {
  projectId: withPm.id,
});
check(`a client starts a conversation with the project team -> ${a.s}`, a.s === 200);
const participants: string[] = a.b?.data?.participantIds ?? [];
check(
  "the recipient is the project's PM",
  participants.includes(pm.id) && participants.includes(clientA.id),
);
const again = await call("POST", "/messages/start-team", clientA.token, {
  projectId: withPm.id,
});
check("starting again reuses the conversation", again.b?.data?.id === a.b?.data?.id);

const sent = await call("POST", "/messages/send", clientA.token, {
  conversationId: a.b?.data?.id,
  text: "Hello team",
});
check(`the client can send in it -> ${sent.s}`, sent.s === 200);
const pmList = await call("GET", "/messages/conversations", pm.token);
check("the PM sees it", JSON.stringify(pmList.b ?? {}).includes(a.b?.data?.id));

const noPm = await mkProject(clientB.orgId, "No PM assigned");
const b = await call("POST", "/messages/start-team", clientB.token, {
  projectId: noPm.id,
});
check(`with no PM assigned it falls back to an administrator -> ${b.s}`, b.s === 200);
const bp: string[] = b.b?.data?.participantIds ?? [];
const other = await prisma.user.findMany({
  where: { id: { in: bp.filter((x) => x !== clientB.id) } },
});
check(
  "...and the recipient is an ADMIN",
  other.length === 1 && other[0].role === "ADMIN",
);

const cross = await call("POST", "/messages/start-team", clientB.token, {
  projectId: withPm.id,
});
check(`another client's project is refused -> ${cross.s}`, cross.s === 404);
const staff = await call("POST", "/messages/start-team", pm.token, {});
check(`staff are told to use /messages/start -> ${staff.s}`, staff.s === 400);
const unknown = await call("POST", "/messages/start-team", clientA.token, {
  userId: admin.id,
});
check(`a client cannot choose the recipient -> ${unknown.s}`, unknown.s === 400);

const convIds = [a.b?.data?.id, b.b?.data?.id].filter(Boolean);
await prisma.message.deleteMany({ where: { conversationId: { in: convIds } } });
await prisma.conversation.deleteMany({ where: { id: { in: convIds } } });
await prisma.project.deleteMany({ where: { id: { in: [withPm.id, noPm.id] } } });
await prisma.engagement.deleteMany({
  where: { id: { in: [withPm.engagementId, noPm.engagementId] } },
});
await prisma.user.deleteMany({ where: { email: { startsWith: "msg-" } } });
await prisma.$disconnect();

let failed = 0;
for (const [label, pass] of checks) {
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}`);
  if (!pass) failed++;
}
console.log(`${checks.length - failed}/${checks.length} passed`);
if (failed) process.exit(1);
console.log("ALL TEAM MESSAGING CHECKS PASSED");
