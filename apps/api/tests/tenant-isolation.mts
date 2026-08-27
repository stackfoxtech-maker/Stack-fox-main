/**
 * Tenant isolation regression test.
 *
 * Every client-facing route filters on `User.orgId -> Engagement.clientId`.
 * This seeds two client tenants, gives one of them a project/invoice/engagement,
 * and asserts the other can neither list nor directly address any of it.
 *
 * Requires the API running on :4000.
 *   pnpm --filter @stackfox/api exec tsx tests/tenant-isolation.mts
 */
import "../src/env";
import { prisma } from "@stackfox/prisma";
import * as ids from "../src/lib/id";
import { hashPassword } from "../src/lib/password";

const BASE = "http://localhost:4000";
const stamp = Date.now();

async function makeClient(tag: string) {
  const email = `iso-${tag}-${stamp}@example.com`;
  const res = await fetch(`${BASE}/auth/register`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: `Iso ${tag}`, email, password: "testpass1234" }),
  });
  const body: any = await res.json();
  return { email, token: body.data.accessToken, userId: body.data.user.id, orgId: body.data.user.orgId };
}

const A = await makeClient("a");
const B = await makeClient("b");
console.log(`A org=${A.orgId}\nB org=${B.orgId}`);

// Give A an engagement + project + invoice; B gets nothing.
const engA = await prisma.engagement.create({
  data: { id: ids.engagementId(), clientId: A.orgId, model: "FPM", commercial: {}, status: "ACTIVE" },
});
const svc = await prisma.serviceUnit.findFirst({ where: { status: "PUBLISHED" } });
const projA = await prisma.project.create({
  data: { id: `SF-ISO-${stamp}`.slice(0, 24), name: "Tenant A secret project",
          engagementId: engA.id, serviceId: svc!.id, configSnapshot: {}, status: "ACTIVE" },
});
await prisma.milestone.create({
  data: { projectId: projA.id, number: 1, name: "Discovery", paymentPct: 30, deliverables: [] },
});
const invA = await prisma.invoice.create({
  data: { id: ids.invoiceId(), engagementId: engA.id, orgId: A.orgId, sacCode: "998314",
          gstType: "IGST", subtotal: 100000, igst: 18000, grandTotal: 118000, status: "SENT" },
});
console.log(`seeded: eng=${engA.id} project=${projA.id} invoice=${invA.id}\n`);

async function get(path: string, token: string) {
  const r = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  return { status: r.status, body: await r.json() as any };
}

const checks: Array<[string, boolean, string]> = [];

for (const [who, tok, shouldSee] of [["A", A.token, true], ["B", B.token, false]] as const) {
  const projects = await get("/projects", tok);
  const n = projects.body.items?.length ?? projects.body.data?.length ?? 0;
  checks.push([`${who} sees ${n} project(s)`, shouldSee ? n === 1 : n === 0, shouldSee ? "expect 1" : "expect 0"]);

  const invoices = await get("/invoices", tok);
  const ni = invoices.body.data?.length ?? 0;
  checks.push([`${who} sees ${ni} invoice(s)`, shouldSee ? ni === 1 : ni === 0, shouldSee ? "expect 1" : "expect 0"]);

  const engs = await get("/engagements", tok);
  const ne = engs.body.data?.length ?? engs.body.length ?? 0;
  checks.push([`${who} sees ${ne} engagement(s)`, shouldSee ? ne === 1 : ne === 0, shouldSee ? "expect 1" : "expect 0"]);
}

// Direct-id probing must 404 for the wrong tenant, not 403 (no existence oracle).
const probe = await get(`/projects/${projA.id}`, B.token);
checks.push([`B probing A's project id -> ${probe.status}`, probe.status === 404, "expect 404"]);

const probeMs = await get(`/projects/${projA.id}/milestones`, B.token);
checks.push([`B probing A's milestones -> ${probeMs.status}`, probeMs.status === 404, "expect 404"]);

const anon = await fetch(`${BASE}/projects`);
checks.push([`anonymous /projects -> ${anon.status}`, anon.status === 401, "expect 401"]);

console.log("--- ISOLATION CHECKS ---");
let failed = 0;
for (const [label, pass, note] of checks) {
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}  (${note})`);
  if (!pass) failed++;
}
console.log(failed === 0 ? "\nALL ISOLATION CHECKS PASSED" : `\n${failed} CHECK(S) FAILED`);
await prisma.$disconnect();
process.exit(failed === 0 ? 0 : 1);
