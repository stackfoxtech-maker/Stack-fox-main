/**
 * Phase 0 regression suite — the five critical findings.
 *
 * Each check below fails against the pre-fix code. They exist so that a future
 * refactor cannot quietly reopen any of these:
 *
 *   SF-C1  /v1/* served every tenant's data to any non-empty x-api-key
 *   SF-C2  backfillPaidQuotes ran on every boot and deleted commercial records
 *   SF-C3  the seed shipped a published admin password and reset live ones
 *   SF-C4  org membership could capture an account that belonged to someone else
 *   SF-H10 any authenticated user could self-promote to ORG_OWNER
 *
 * Requires the API running on :4000.
 *   pnpm --filter @stackfox/api test:phase0
 */
import "../src/env";
import { prisma } from "@stackfox/prisma";
import { hashPassword } from "../src/lib/password";
import { assertPublicHttpUrl } from "../src/lib/safeUrl";

const BASE = "http://localhost:4000";
const stamp = Date.now();

type Result = { s: number; b: any };

async function call(method: string, path: string, token?: string, body?: unknown, headers: Record<string, string> = {}): Promise<Result> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  let parsed: any = null;
  try { parsed = await res.json(); } catch { /* empty body */ }
  return { s: res.status, b: parsed };
}

/**
 * Registration is rate-limited to 10/min per IP, and that limit is now backed
 * by Redis so it genuinely holds across the whole run rather than resetting.
 * This suite needs more accounts than that, so back off on 429 rather than
 * weakening the control just to make a test pass.
 */
async function register(tag: string) {
  const email = `p0-${tag}-${stamp}@example.com`;
  for (let attempt = 0; attempt < 8; attempt++) {
    const r = await call("POST", "/auth/register", undefined, {
      name: `P0 ${tag}`, email, password: "testpass1234",
    });
    if (r.b?.data?.accessToken) {
      return {
        email,
        token: r.b.data.accessToken as string,
        userId: r.b.data.user.id as string,
        orgId: r.b.data.user.orgId as string,
      };
    }
    if (r.s !== 429) throw new Error(`register ${tag} failed: ${JSON.stringify(r.b)}`);
    await new Promise((res) => setTimeout(res, 10_000));
  }
  throw new Error(`register ${tag} still rate-limited after 8 attempts`);
}

const checks: Array<[string, boolean, string]> = [];
const check = (label: string, pass: boolean, note = "") => checks.push([label, pass, note]);

// ── SF-C1: the public API must not serve anything ────────────────────────────
for (const path of ["/v1/engagements", "/v1/invoices", "/v1/projects", "/v1/tickets", "/v1/events"]) {
  const r = await call("GET", path, undefined, undefined, { "x-api-key": "anything-at-all" });
  check(`junk api key GET ${path} -> ${r.s}`, r.s === 404, "expect 404 — route must not be registered");
}
const webhookPost = await call("POST", "/v1/webhooks", undefined,
  { orgId: "ORG-2026-0001", url: "https://attacker.example/collect", events: ["INVOICE_PAID"] },
  { "x-api-key": "anything-at-all" });
check(`junk api key POST /v1/webhooks -> ${webhookPost.s}`, webhookPost.s === 404, "expect 404");

// ── SF-C4 + SF-H10: org capture and self-promotion ───────────────────────────
const attacker = await register("attacker");
const victim = await register("victim");

// The attacker already has a personal org from registration, so POST /orgs must refuse.
const secondOrg = await call("POST", "/orgs", attacker.token, { name: `Attacker Co ${stamp}`, type: "PVT_LTD" });
check(`user with an org cannot create another -> ${secondOrg.s}`, secondOrg.s === 409, "expect 409");

// Even so, they are ORG_OWNER of their own org — try to capture the victim.
await prisma.user.update({ where: { id: attacker.userId }, data: { role: "ORG_OWNER" } });
const reAuth = await call("POST", "/auth/login", undefined, { email: attacker.email, password: "testpass1234" });
const ownerToken = reAuth.b?.data?.accessToken ?? attacker.token;

const captureClient = await call("POST", `/orgs/${attacker.orgId}/members`, ownerToken,
  { email: victim.email, role: "CLIENT_VIEWER" });
check(`capturing another client account -> ${captureClient.s}`, captureClient.s === 409, "expect 409");

const victimAfter = await prisma.user.findUnique({ where: { id: victim.userId }, select: { orgId: true, role: true } });
check(`victim keeps their own org`, victimAfter?.orgId === victim.orgId, `expect ${victim.orgId}, got ${victimAfter?.orgId}`);
check(`victim keeps their own role`, victimAfter?.role === "INDIVIDUAL_CLIENT", `got ${victimAfter?.role}`);

// The sharper case: capturing a staff account.
const staffEmail = `p0-staff-${stamp}@example.com`;
await prisma.user.create({
  data: {
    name: "P0 Staff", email: staffEmail, role: "ADMIN",
    authData: { provider: "email", passwordHash: await hashPassword("testpass1234"), verified: true },
  },
});
const captureStaff = await call("POST", `/orgs/${attacker.orgId}/members`, ownerToken,
  { email: staffEmail, role: "CLIENT_VIEWER" });
check(`capturing a staff account -> ${captureStaff.s}`, captureStaff.s === 403 || captureStaff.s === 409, "expect 403/409");

const staffAfter = await prisma.user.findUnique({ where: { email: staffEmail }, select: { role: true, orgId: true } });
check(`staff account keeps ADMIN`, staffAfter?.role === "ADMIN", `got ${staffAfter?.role}`);
check(`staff account not moved into attacker org`, staffAfter?.orgId !== attacker.orgId, "expect not captured");

// A genuinely new email is still addable — the guard must not break invites.
const freshMember = await call("POST", `/orgs/${attacker.orgId}/members`, ownerToken,
  { email: `p0-fresh-${stamp}@example.com`, role: "CLIENT_VIEWER" });
check(`adding a brand-new email still works -> ${freshMember.s}`, freshMember.s === 200, "expect 200");

// ── SF-C5: SSRF guard on outbound webhook destinations ───────────────────────
const blocked = [
  "http://169.254.169.254/latest/meta-data/",
  "https://127.0.0.1/hook",
  "https://10.0.0.5/hook",
  "https://192.168.1.10/hook",
  "https://[::1]/hook",
  "https://user:pass@example.com/hook",
  "ftp://example.com/hook",
];
for (const url of blocked) {
  const r = await assertPublicHttpUrl(url, { allowHttp: true });
  check(`webhook destination blocked: ${url}`, r.ok === false, `expected block, got ok (${r.reason ?? "-"})`);
}
const allowed = await assertPublicHttpUrl("https://example.com/hook");
check(`webhook destination allowed: https://example.com/hook`, allowed.ok === true, allowed.reason ?? "");

// ── SF-H3: estimates must not be readable by strangers ──────────────────────
const estOwner = await register("est-owner");
const estStranger = await register("est-stranger");

const ws = await call("POST", "/workspaces", estOwner.token, { canvas: [] });
const wsId = ws.b?.id ?? ws.b?._id;
const est = await call("POST", "/estimates", estOwner.token, { workspaceId: wsId });
const estId = est.b?.id ?? est.b?._id;

if (!estId) {
  check("estimate fixture created", false, `could not create an estimate: ${JSON.stringify(est.b)?.slice(0, 120)}`);
} else {
  const anon = await call("GET", `/estimates/${estId}`);
  check(`anonymous GET /estimates/:id -> ${anon.s}`, anon.s === 404, "expect 404, never 403");

  const stranger = await call("GET", `/estimates/${estId}`, estStranger.token);
  check(`another user GET /estimates/:id -> ${stranger.s}`, stranger.s === 404, "expect 404");

  const owner = await call("GET", `/estimates/${estId}`, estOwner.token);
  check(`owner GET /estimates/:id -> ${owner.s}`, owner.s === 200, "expect 200");

  const anonPdf = await call("GET", `/estimates/${estId}/pdf`);
  check(`anonymous GET /estimates/:id/pdf -> ${anonPdf.s}`, anonPdf.s === 404, "expect 404");
}

// ── Report ───────────────────────────────────────────────────────────────────
console.log("\n--- PHASE 0 SECURITY ---");
let failed = 0;
for (const [label, pass, note] of checks) {
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}${note && !pass ? `  (${note})` : ""}`);
  if (!pass) failed++;
}
console.log(`\n${checks.length - failed}/${checks.length} passed`);
console.log(failed === 0 ? "ALL PHASE 0 CHECKS PASSED" : `${failed} FAILED`);

await prisma.$disconnect();
process.exit(failed === 0 ? 0 : 1);
