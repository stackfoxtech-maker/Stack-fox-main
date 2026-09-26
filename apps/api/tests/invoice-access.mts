/**
 * Who may read invoices.
 *
 * Every internal role used to be able to list every client's invoices,
 * including developers, QA, designers, devops and sales, while the finance
 * reports were already limited to the finance-viewing roles. Invoices now
 * follow the same policy. Clients still see only their own.
 *
 *   pnpm --filter @stackfox/api exec tsx tests/invoice-access.mts
 */
import "../src/env";
import { prisma } from "@stackfox/prisma";
import * as ids from "../src/lib/id";

const BASE = process.env.TEST_API_URL ?? "http://localhost:4000";
const stamp = Date.now();
const checks: Array<[string, boolean]> = [];
const check = (label: string, pass: boolean) => checks.push([label, pass]);

async function get(path: string, token: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.status;
}

async function actor(tag: string, role?: string) {
  const email = `inv-${tag}-${stamp}@example.com`;
  const res = await fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: `Inv ${tag}`, email, password: "InvoicePass123!ok" }),
  });
  const b = (await res.json()) as any;
  if (role) await prisma.user.update({ where: { email }, data: { role, orgId: null } });
  const login = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "InvoicePass123!ok" }),
  });
  const d = ((await login.json()) as any).data;
  return { token: d.accessToken as string, orgId: b.data.user.orgId as string };
}

const owner = await actor("owner");
const other = await actor("other");
// A sample, not every role: registration is rate-limited to 10/min, and the
// full 10-role matrix is exercised elsewhere.
const roles = ["DEVELOPER", "SALES", "SE"];
const allowed = ["FINANCE", "PM"];
const staff: Record<string, { token: string }> = {};
for (const r of [...roles, ...allowed]) staff[r] = await actor(r.toLowerCase(), r);

const invoice = await prisma.invoice.create({
  data: {
    id: ids.invoiceId(),
    orgId: owner.orgId,
    sacCode: "998314",
    gstType: "IGST",
    subtotal: 100000,
    igst: 18000,
    grandTotal: 118000,
    status: "SENT",
  },
});

for (const r of roles) {
  for (const p of [
    "/invoices",
    `/invoices/${invoice.id}`,
    `/invoices/${invoice.id}/pdf`,
  ]) {
    const s = await get(p, staff[r].token);
    check(`${r} ${p.replace(invoice.id, ":id")} -> ${s}`, s === 403);
  }
}
for (const r of allowed) {
  const s = await get("/invoices", staff[r].token);
  check(`${r} /invoices -> ${s}`, s === 200);
  const d = await get(`/invoices/${invoice.id}`, staff[r].token);
  check(`${r} /invoices/:id -> ${d}`, d === 200);
}
check(
  `the owning client reads their invoice -> ${await get(`/invoices/${invoice.id}`, owner.token)}`,
  (await get(`/invoices/${invoice.id}`, owner.token)) === 200,
);
check(
  `another client cannot -> ${await get(`/invoices/${invoice.id}`, other.token)}`,
  (await get(`/invoices/${invoice.id}`, other.token)) === 404,
);

await prisma.invoice.delete({ where: { id: invoice.id } });
await prisma.user.deleteMany({ where: { email: { startsWith: "inv-" } } });
await prisma.$disconnect();

let failed = 0;
for (const [label, pass] of checks) {
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}`);
  if (!pass) failed++;
}
console.log(`${checks.length - failed}/${checks.length} passed`);
if (failed) process.exit(1);
console.log("ALL INVOICE ACCESS CHECKS PASSED");
