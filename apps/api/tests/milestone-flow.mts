/**
 * Milestone delivery: the team starts and submits, a PM or admin approves.
 *
 * Nothing used to move a milestone to IN_REVIEW, so the admin Approve button
 * could never succeed ("Milestone must be IN_REVIEW to approve"). Approval also
 * checked the status and then updated it in two steps, so two approvers at
 * once could both pass the check and raise the milestone invoice twice.
 *
 *   pnpm --filter @stackfox/api exec tsx tests/milestone-flow.mts
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
  const email = `ms-${tag}-${stamp}@example.com`;
  const reg = await fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: `MS ${tag}`, email, password: "MilestonePass123!" }),
  });
  const rb = (await reg.json()) as any;
  if (!role)
    return { token: rb.data.accessToken as string, orgId: rb.data.user.orgId as string };
  await prisma.user.update({ where: { email }, data: { role, orgId: null } });
  const login = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "MilestonePass123!" }),
  });
  return { token: ((await login.json()) as any).data.accessToken as string, orgId: "" };
}

const client = await actor("client");
const dev = await actor("dev", "DEVELOPER");
const pm = await actor("pm", "PM");
const sales = await actor("sales", "SALES");
const admin = await actor("admin", "ADMIN");

const svc = await prisma.serviceUnit.findFirst({ where: { status: "PUBLISHED" } });
const eng = await prisma.engagement.create({
  data: {
    id: ids.engagementId(),
    clientId: client.orgId,
    model: "FPM",
    commercial: {},
    status: "ACTIVE",
  },
});
const project = await prisma.project.create({
  data: {
    id: `SF-MS-${String(stamp).slice(-8)}`,
    name: "Milestone flow",
    engagementId: eng.id,
    serviceId: svc!.id,
    configSnapshot: {},
    status: "ACTIVE",
  },
});
await prisma.milestone.createMany({
  data: [1, 2].map((number) => ({
    projectId: project.id,
    number,
    name: `M${number}`,
    paymentPct: 50,
    deliverables: [],
  })),
});
const m = (n: number) => `/projects/${project.id}/milestones/${n}`;
const statusOf = async (n: number) =>
  (await prisma.milestone.findUnique({
    where: { projectId_number: { projectId: project.id, number: n } },
  }))!.status;

// ── Cannot approve what was never submitted ──────────────────────────────────
check(
  `approving an UPCOMING milestone -> ${(await call("PATCH", `${m(1)}/approve`, pm.token)).s}`,
  (await call("PATCH", `${m(1)}/approve`, pm.token)).s === 409,
);
check(
  `skipping straight to IN_REVIEW -> ${(await call("PATCH", `${m(1)}/status`, dev.token, { status: "IN_REVIEW" })).s}`,
  (await statusOf(1)) === "UPCOMING",
);

// ── Who may move it ──────────────────────────────────────────────────────────
check(
  `sales cannot start delivery work -> ${(await call("PATCH", `${m(1)}/status`, sales.token, { status: "IN_PROGRESS" })).s}`,
  (await statusOf(1)) === "UPCOMING",
);
check(
  `a client cannot start it -> ${(await call("PATCH", `${m(1)}/status`, client.token, { status: "IN_PROGRESS" })).s}`,
  (await statusOf(1)) === "UPCOMING",
);
const start = await call("PATCH", `${m(1)}/status`, dev.token, { status: "IN_PROGRESS" });
check(
  `a developer starts it -> ${start.s}`,
  start.s === 200 && (await statusOf(1)) === "IN_PROGRESS",
);
const submit = await call("PATCH", `${m(1)}/status`, dev.token, { status: "IN_REVIEW" });
check(
  `a developer submits it for review -> ${submit.s}`,
  submit.s === 200 && (await statusOf(1)) === "IN_REVIEW",
);
const bogus = await call("PATCH", `${m(1)}/status`, dev.token, { status: "APPROVED" });
check(
  `approval is not reachable through the status route -> ${bogus.s}`,
  bogus.s === 400,
);

// ── Who may approve ──────────────────────────────────────────────────────────
check(
  `a developer cannot approve -> ${(await call("PATCH", `${m(1)}/approve`, dev.token)).s}`,
  (await statusOf(1)) === "IN_REVIEW",
);
check(
  `a client cannot approve -> ${(await call("PATCH", `${m(1)}/approve`, client.token)).s}`,
  (await statusOf(1)) === "IN_REVIEW",
);

// ── Revision loop ────────────────────────────────────────────────────────────
const rev = await call("PATCH", `${m(1)}/request-revision`, pm.token, {
  feedback: "Fix the header",
});
check(
  `a PM sends it back -> ${rev.s}`,
  rev.s === 200 && (await statusOf(1)) === "REVISION",
);
const resub = await call("PATCH", `${m(1)}/status`, dev.token, { status: "IN_REVIEW" });
check(
  `the team resubmits -> ${resub.s}`,
  resub.s === 200 && (await statusOf(1)) === "IN_REVIEW",
);

// ── Two approvers at once raise one invoice ─────────────────────────────────
const [a, b] = await Promise.all([
  call("PATCH", `${m(1)}/approve`, pm.token),
  call("PATCH", `${m(1)}/approve`, admin.token),
]);
const codes = [a.s, b.s].sort();
check(
  `concurrent approvals: exactly one wins (${codes.join(", ")})`,
  codes[0] === 200 && codes[1] === 409,
);
const approved = await prisma.milestone.findUnique({
  where: { projectId_number: { projectId: project.id, number: 1 } },
});
check(
  "it is APPROVED with a timestamp",
  approved?.status === "APPROVED" && !!approved.approvedAt,
);
const approvals = await prisma.event.count({
  where: { code: "MILESTONE_APPROVED", projectId: project.id },
});
check(`one approval was recorded (${approvals})`, approvals === 1);
const late = await call("PATCH", `${m(1)}/request-revision`, pm.token, {
  feedback: "late",
});
check(`an approved milestone cannot be sent back -> ${late.s}`, late.s === 409);

// ── Admin can run the whole thing too ───────────────────────────────────────
await call("PATCH", `${m(2)}/status`, admin.token, { status: "IN_PROGRESS" });
await call("PATCH", `${m(2)}/status`, admin.token, { status: "IN_REVIEW" });
const adminApprove = await call("PATCH", `${m(2)}/approve`, admin.token);
check(
  `an admin approves -> ${adminApprove.s}`,
  adminApprove.s === 200 && (await statusOf(2)) === "APPROVED",
);

await prisma.event.deleteMany({ where: { projectId: project.id } });
await prisma.milestone.deleteMany({ where: { projectId: project.id } });
await prisma.project.delete({ where: { id: project.id } });
await prisma.engagement.delete({ where: { id: eng.id } });
await prisma.user.deleteMany({ where: { email: { startsWith: "ms-" } } });
await prisma.$disconnect();

let failed = 0;
for (const [label, pass] of checks) {
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}`);
  if (!pass) failed++;
}
console.log(`${checks.length - failed}/${checks.length} passed`);
if (failed) process.exit(1);
console.log("ALL MILESTONE FLOW CHECKS PASSED");
