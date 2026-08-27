/**
 * Access-control regression suite.
 *
 * Covers the authorisation rules the portal depends on: anonymous access,
 * cross-tenant reads, client-vs-internal separation, privilege escalation, and
 * the routes that used to leak company-wide financial data.
 *
 * Requires the API running on :4000.
 *   pnpm --filter @stackfox/api test:access
 */
import "../src/env";
import { prisma } from "@stackfox/prisma";
import { hashPassword } from "../src/lib/password";
import * as ids from "../src/lib/id";

const BASE = "http://localhost:4000";
const stamp = Date.now();

type Result = { s: number; b: any };

async function call(method: string, path: string, token?: string, body?: unknown): Promise<Result> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  let parsed: any = null;
  try { parsed = await res.json(); } catch { /* empty body */ }
  return { s: res.status, b: parsed };
}

async function register(tag: string) {
  const email = `ac-${tag}-${stamp}@example.com`;
  const r = await call("POST", "/auth/register", undefined, {
    name: `AC ${tag}`, email, password: "testpass1234",
  });
  if (!r.b?.data?.accessToken) throw new Error(`register ${tag} failed: ${JSON.stringify(r.b)}`);
  return { email, token: r.b.data.accessToken as string, userId: r.b.data.user.id as string, orgId: r.b.data.user.orgId as string };
}

/** Creates a staff account directly, then logs in through the real endpoint. */
async function makeStaff(role: string) {
  const email = `ac-staff-${role.toLowerCase()}-${stamp}@example.com`;
  await prisma.user.create({
    data: {
      name: `Staff ${role}`, email, role,
      authData: { provider: "email", passwordHash: await hashPassword("testpass1234"), verified: true },
    },
  });
  const r = await call("POST", "/auth/login", undefined, { email, password: "testpass1234" });
  if (!r.b?.data?.accessToken) throw new Error(`staff login failed: ${JSON.stringify(r.b)}`);
  return { email, token: r.b.data.accessToken as string, userId: r.b.data.user.id as string };
}

const checks: Array<[string, boolean, string]> = [];
const check = (label: string, pass: boolean, note = "") => checks.push([label, pass, note]);

// ── Actors ───────────────────────────────────────────────────────────────────
const clientA = await register("a");
const clientB = await register("b");
const admin = await makeStaff("ADMIN");
const se = await makeStaff("SE");

// ── Tenant A owns some data ──────────────────────────────────────────────────
const eng = await prisma.engagement.create({
  data: { id: ids.engagementId(), clientId: clientA.orgId, model: "FPM", commercial: {}, status: "ACTIVE" },
});
const svc = await prisma.serviceUnit.findFirst({ where: { status: "PUBLISHED" } });
const project = await prisma.project.create({
  data: { id: `SF-AC-${String(stamp).slice(-8)}`, name: "Tenant A project",
          engagementId: eng.id, serviceId: svc!.id, configSnapshot: {}, status: "ACTIVE" },
});
const ticket = await prisma.ticket.create({
  data: { id: ids.ticketId(), projectId: project.id, raisedBy: clientA.userId,
          subject: "Tenant A ticket", description: "private", severity: "P2" },
});
const invoice = await prisma.invoice.create({
  data: { id: ids.invoiceId(), engagementId: eng.id, orgId: clientA.orgId, sacCode: "998314",
          gstType: "IGST", subtotal: 100000, igst: 18000, grandTotal: 118000, status: "SENT" },
});
const program = await prisma.program.create({
  data: { id: ids.programId(), clientId: clientA.orgId, name: "Tenant A programme" },
});
const workspace = await prisma.workspace.create({
  data: { userId: clientA.userId, canvas: [], canonicalHash: `ac-${stamp}` },
});

// ── 1. Anonymous access ──────────────────────────────────────────────────────
for (const path of ["/projects", "/invoices", "/events", "/tickets", "/files", "/contracts",
                    "/reports/summary", "/handover/projects", "/engagements"]) {
  const r = await call("GET", path);
  check(`anon GET ${path} -> ${r.s}`, r.s === 401, "expect 401");
}
for (const path of ["/admin/services", "/admin/users", "/admin/rate-cards", "/admin/flags"]) {
  const r = await call("GET", path);
  check(`anon GET ${path} -> ${r.s}`, r.s === 401, "expect 401");
}
// These returned the whole company's finances to the public internet.
for (const path of ["/finance/ar-aging", "/finance/wip", "/finance/rev-rec", "/finance/gstr1", "/rfps"]) {
  const r = await call("GET", path);
  check(`anon GET ${path} -> ${r.s}`, r.s === 401, "expect 401");
}

// ── 2. Cross-tenant reads ────────────────────────────────────────────────────
const bProjects = await call("GET", "/projects", clientB.token);
check(`B lists 0 projects`, (bProjects.b?.data?.length ?? -1) === 0, "expect 0");

const aProjects = await call("GET", "/projects", clientA.token);
check(`A lists its own project`, (aProjects.b?.data ?? []).some((p: any) => p.id === project.id), "expect 1");

for (const [label, path] of [
  ["project", `/projects/${project.id}`],
  ["milestones", `/projects/${project.id}/milestones`],
  ["invoice", `/invoices/${invoice.id}`],
  ["ticket", `/tickets/${ticket.id}`],
  ["programme", `/programs/${program.id}`],
  ["programme health", `/programs/${program.id}/health`],
  ["handover kit", `/handover/${project.id}`],
  ["workspace", `/workspaces/${workspace.id}`],
] as const) {
  const r = await call("GET", path, clientB.token);
  check(`B probing A's ${label} -> ${r.s}`, r.s === 404, "expect 404, never 403");
}

const bTickets = await call("GET", "/tickets", clientB.token);
check(`B lists 0 tickets`, (bTickets.b?.data?.length ?? -1) === 0, "expect 0");

const bInvoices = await call("GET", "/invoices", clientB.token);
check(`B lists 0 invoices`, (bInvoices.b?.data?.length ?? -1) === 0, "expect 0");

// ── 3. Clients cannot reach internal surfaces ────────────────────────────────
for (const path of ["/admin/services", "/admin/users", "/finance/ar-aging", "/rfps"]) {
  const r = await call("GET", path, clientA.token);
  check(`client GET ${path} -> ${r.s}`, r.s === 403, "expect 403");
}
const clientCreatesEngagement = await call("POST", "/engagements", clientA.token, {
  clientId: clientA.orgId, model: "FPM",
});
check(`client POST /engagements -> ${clientCreatesEngagement.s}`, clientCreatesEngagement.s === 403, "expect 403");

// A client must not be able to sign off their own workspace review.
const selfApprove = await call("POST", `/workspaces/${workspace.id}/se-approve`, clientA.token);
check(`client self SE-approve -> ${selfApprove.s}`, selfApprove.s === 403, "expect 403");
const seApprove = await call("POST", `/workspaces/${workspace.id}/se-approve`, se.token);
check(`SE can approve -> ${seApprove.s}`, seApprove.s === 200, "expect 200");

// ── 4. Privilege escalation ──────────────────────────────────────────────────
const seEscalate = await call("PATCH", `/admin/users/${se.userId}`, se.token, { role: "ADMIN" });
check(`SE promoting self to ADMIN -> ${seEscalate.s}`, seEscalate.s === 403, "expect 403");

const adminSelfDemote = await call("PATCH", `/admin/users/${admin.userId}`, admin.token, { role: "PM" });
check(`admin changing own role -> ${adminSelfDemote.s}`, adminSelfDemote.s === 409, "expect 409");

const bogusRole = await call("PATCH", `/admin/users/${clientA.userId}`, admin.token, { role: "GOD_MODE" });
check(`admin setting unknown role -> ${bogusRole.s}`, bogusRole.s === 400, "expect 400");

// Mass assignment: a field outside the allowlist must not be written.
const massAssign = await call("PATCH", `/admin/users/${clientB.userId}`, admin.token, {
  name: "Renamed", email: "hijacked@example.com",
});
const afterMass = await prisma.user.findUnique({ where: { id: clientB.userId } });
check(`admin update honours allowlist -> ${massAssign.s}`, massAssign.s === 200, "expect 200");
check(`email not overwritable`, afterMass?.email === clientB.email, "email must be unchanged");
check(`name was updated`, afterMass?.name === "Renamed", "name is allowlisted");

// ── 5. Internal staff legitimately see across tenants ────────────────────────
const adminProjects = await call("GET", "/projects", admin.token);
check(`admin sees tenant A's project`,
  (adminProjects.b?.data ?? []).some((p: any) => p.id === project.id), "internal is cross-tenant");
const adminFinance = await call("GET", "/finance/ar-aging", admin.token);
check(`admin GET /finance/ar-aging -> ${adminFinance.s}`, adminFinance.s === 200, "expect 200");

// ── 6. Session revocation ────────────────────────────────────────────────────
const throwaway = await register("revoke");
await call("POST", "/auth/logout", throwaway.token);
const afterLogout = await call("GET", "/auth/me", throwaway.token);
check(`token rejected after logout -> ${afterLogout.s}`, afterLogout.s === 401, "expect 401");

// ── 7. Referral scoping (used to list every user's referrals) ─────────────────
await prisma.referral.create({
  data: { referrerType: "CLIENT", referrerId: clientA.userId, code: `AC${stamp}`.slice(0, 10),
          referredEmail: `friend-${stamp}@example.com`, status: "PENDING", commissionAmount: 50000 },
});
const bReferrals = await call("GET", "/referrals", clientB.token);
check(`B lists 0 referrals`, (bReferrals.b?.data?.length ?? -1) === 0, "expect 0");
const bStats = await call("GET", "/referrals/stats", clientB.token);
check(`B earnings are 0, not platform-wide`, bStats.b?.data?.totalEarnings === 0, "expect 0");

// ── Report ───────────────────────────────────────────────────────────────────
console.log("\n--- ACCESS CONTROL ---");
let failed = 0;
for (const [label, pass, note] of checks) {
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}${note && !pass ? `  (${note})` : ""}`);
  if (!pass) failed++;
}
console.log(`\n${checks.length - failed}/${checks.length} passed`);
console.log(failed === 0 ? "ALL ACCESS CONTROL CHECKS PASSED" : `${failed} FAILED`);

await prisma.$disconnect();
process.exit(failed === 0 ? 0 : 1);
