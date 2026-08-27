/**
 * Staff-facing surfaces: team workload, staff directory, analytics and
 * settings. Confirms each returns real data to staff and is closed to clients.
 *
 *   pnpm --filter @stackfox/api exec tsx tests/staff-surfaces.mts
 */
import "../src/env";
import { prisma } from "@stackfox/prisma";

const BASE = "http://localhost:4000";

async function login(email: string): Promise<string | undefined> {
  const r = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "testpass1234" }),
  });
  return ((await r.json()) as any)?.data?.accessToken;
}

const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "desc" } });
const client = await prisma.user.findFirst({
  where: { role: "INDIVIDUAL_CLIENT", email: { startsWith: "ac-a-" } },
  orderBy: { createdAt: "desc" },
});
if (!admin || !client) throw new Error("Run tests/access-control.mts first to seed actors.");

const at = await login(admin.email);
const ct = await login(client.email);
if (!at || !ct) throw new Error("Could not log in test actors");

const checks: Array<[string, boolean]> = [];
const get = async (path: string, token: string) => {
  const r = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  return { s: r.status, b: (await r.json()) as any };
};

const wl = await get("/tasks/workload", at);
checks.push([`staff /tasks/workload -> ${wl.s}`, wl.s === 200]);
checks.push([`workload returns rows (${wl.b.data?.length})`, Array.isArray(wl.b.data)]);
checks.push([`workload reports capacity (${wl.b.meta?.capacity})`, typeof wl.b.meta?.capacity === "number"]);
if (wl.b.data?.[0]) {
  const r = wl.b.data[0];
  checks.push([
    `workload row has real fields (open=${r.openTasks} load=${r.load}%)`,
    typeof r.openTasks === "number" && typeof r.load === "number" && typeof r.name === "string",
  ]);
}

const wlc = await get("/tasks/workload", ct);
checks.push([`client /tasks/workload -> ${wlc.s}`, wlc.s === 403]);

const dir = await get("/users/directory", at);
checks.push([`staff /users/directory -> ${dir.s} (${dir.b.data?.length} staff)`, dir.s === 200]);
checks.push([
  `directory excludes client accounts`,
  Array.isArray(dir.b.data) && !dir.b.data.some((u: any) => u.role === "INDIVIDUAL_CLIENT"),
]);
const dirc = await get("/users/directory", ct);
checks.push([`client /users/directory -> ${dirc.s}`, dirc.s === 403]);

for (const path of ["/analytics/overview", "/analytics/revenue", "/analytics/conversion", "/analytics/services"]) {
  const asClient = await get(path, ct);
  checks.push([`client ${path} -> ${asClient.s}`, asClient.s === 403]);
  const asStaff = await get(path, at);
  checks.push([`staff ${path} -> ${asStaff.s}`, asStaff.s === 200]);
}

const st = await get("/settings", at);
checks.push([`staff /settings -> ${st.s}`, st.s === 200]);
checks.push([`settings reports storage as configured`, st.b.data?.integrations?.storage?.configured === true]);
checks.push([`settings reads feature flags from the table`, Array.isArray(st.b.data?.featureFlags)]);
const stc = await get("/settings", ct);
checks.push([`client /settings -> ${stc.s}`, stc.s === 403]);

const blog = await fetch(`${BASE}/blog`);
const blogBody = (await blog.json()) as any;
checks.push([`public /blog -> ${blog.status} (${blogBody.data?.length} posts from the DB)`, blog.status === 200 && blogBody.data?.length > 0]);

console.log("\n--- STAFF SURFACES ---");
let failed = 0;
for (const [label, pass] of checks) {
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}`);
  if (!pass) failed++;
}
console.log(`\n${checks.length - failed}/${checks.length} passed`);
await prisma.$disconnect();
process.exit(failed === 0 ? 0 : 1);
