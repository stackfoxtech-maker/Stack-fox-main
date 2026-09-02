/**
 * Exercises the Reports and Handover backends against a real seeded tenant.
 * Requires the API running on :4000.
 *   pnpm --filter @stackfox/api exec tsx tests/reports-handover.mts
 */
import "../src/env";
import { prisma } from "@stackfox/prisma";
import * as ids from "../src/lib/id";
import { encryptSecret } from "../src/lib/crypto";

const BASE = "http://localhost:4000";
const stamp = Date.now();
const email = `kit-${stamp}@example.com`;

const reg = await fetch(`${BASE}/auth/register`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: "Kit Tester", email, password: "testpass1234" }),
});
const regBody: any = await reg.json();
if (!regBody?.data?.accessToken) { console.error("register failed:", regBody); process.exit(1); }
const { accessToken: token, orgId } = { accessToken: regBody.data.accessToken, orgId: regBody.data.user.orgId };
console.log(`tenant ${orgId}`);

// Seed a delivered project: engagement -> project -> approved milestones,
// a paid invoice, a stored file, and a vault entry.
const eng = await prisma.engagement.create({
  data: { id: ids.engagementId(), clientId: orgId, model: "FPM", commercial: {}, status: "ACTIVE" },
});
const svc = await prisma.serviceUnit.findFirst({ where: { status: "PUBLISHED" } });
const proj = await prisma.project.create({
  data: { id: `SF-KIT-${String(stamp).slice(-8)}`, name: "Handover Kit Demo",
          engagementId: eng.id, serviceId: svc!.id, configSnapshot: {}, status: "COMPLETED" },
});
const past = new Date(Date.now() - 5 * 86400000);
for (const n of [1, 2]) {
  await prisma.milestone.create({
    data: { projectId: proj.id, number: n, name: `Milestone ${n}`, paymentPct: 50,
            deliverables: [], status: "APPROVED", dueDate: past, approvedAt: past, feedbackRound: 1 },
  });
}
await prisma.invoice.create({
  data: { id: ids.invoiceId(), engagementId: eng.id, orgId, sacCode: "998314", gstType: "IGST",
          subtotal: 5000000, igst: 900000, grandTotal: 5900000, status: "PAID", paidAt: past },
});
await prisma.file.create({
  data: { projectId: proj.id, name: "source-bundle.zip", storageKey: `files/${proj.id}/source.zip`,
          sizeBytes: 10240, mimeType: "application/zip", uploadedBy: regBody.data.user.id },
});
const vault = await prisma.credentialVault.create({
  data: { projectId: proj.id, systemName: "Production hosting",
          encryptedBlob: encryptSecret(JSON.stringify({ user: "deploy", password: "s3cr3t" })) },
});
console.log(`seeded project ${proj.id}\n`);

const H = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
const get = async (p: string) => { const r = await fetch(`${BASE}${p}`, { headers: H }); return { s: r.status, b: await r.json() as any }; };
const post = async (p: string, body?: unknown) => {
  const r = await fetch(`${BASE}${p}`, { method: "POST", headers: H, body: JSON.stringify(body ?? {}) });
  return { s: r.status, b: await r.json() as any };
};

const checks: Array<[string, boolean]> = [];

const summary = await get("/reports/summary");
const d = summary.b.data;
checks.push([`reports/summary -> ${summary.s}`, summary.s === 200]);
checks.push([`spend.totals.paid = ${d?.spend?.totals?.paid} (expect 59000)`, d?.spend?.totals?.paid === 59000]);
checks.push([`spend.series has 6 months`, d?.spend?.series?.length === 6]);
checks.push([`timeline.totals.approved = ${d?.timeline?.totals?.approved} (expect 2)`, d?.timeline?.totals?.approved === 2]);
checks.push([`timeline onTimePct = ${d?.timeline?.totals?.onTimePct} (expect 100)`, d?.timeline?.totals?.onTimePct === 100]);
checks.push([`revisions roundsUsed = ${d?.revisions?.totals?.roundsUsed} (expect 2)`, d?.revisions?.totals?.roundsUsed === 2]);
checks.push([`engagement report present`, typeof d?.engagement?.totals === "object"]);

const gen = await post("/reports/generate", { type: "spend" });
checks.push([`reports/generate -> ${gen.s}`, gen.s === 200]);
// A downloadable copy is only persisted when report storage (Supabase) is
// configured; otherwise the endpoint returns the payload with downloadUrl:null
// by design. Assert the string + fetch only when storage is available.
const storageEnv = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
const genUrl = gen.b?.data?.downloadUrl;
checks.push([
  `generate download URL (${genUrl})`,
  storageEnv ? typeof genUrl === "string" : genUrl === null || typeof genUrl === "string",
]);
if (typeof genUrl === "string") {
  const dl = await fetch(genUrl);
  checks.push([`download URL fetches -> ${dl.status}`, dl.status === 200]);
}
const bad = await post("/reports/generate", { type: "nonsense" });
checks.push([`unknown report type -> ${bad.s} (expect 400)`, bad.s === 400]);

const hp = await get("/handover/projects");
checks.push([`handover/projects -> ${hp.s}`, hp.s === 200]);
checks.push([`lists the seeded project`, (hp.b.data ?? []).some((p: any) => p.id === proj.id)]);

const kit = await get(`/handover/${proj.id}`);
checks.push([`handover kit -> ${kit.s}`, kit.s === 200]);
checks.push([`kit has 1 deliverable`, kit.b?.data?.deliverables?.length === 1]);
checks.push([`kit has 1 credential (metadata only)`, kit.b?.data?.credentials?.length === 1]);
checks.push([`credential blob NOT exposed`, kit.b?.data?.credentials?.[0]?.encryptedBlob === undefined]);
checks.push([`checklist computed`, Array.isArray(kit.b?.data?.checklist) && kit.b.data.checklist.length === 5]);
checks.push([`readyToAccept = ${kit.b?.data?.readyToAccept} (expect true)`, kit.b?.data?.readyToAccept === true]);

const reveal = await post(`/handover/${proj.id}/credentials/${vault.id}/reveal`);
checks.push([`credential reveal -> ${reveal.s}`, reveal.s === 200]);
checks.push([`decrypts correctly`, reveal.b?.data?.credentials?.password === "s3cr3t"]);
const audited = await prisma.credentialVault.findUnique({ where: { id: vault.id } });
checks.push([`reveal is audit-logged`, Array.isArray(audited?.accessLog) && (audited!.accessLog as any[]).length === 1]);

const accept = await post(`/handover/${proj.id}/accept`, { notes: "All good" });
checks.push([`handover accept -> ${accept.s}`, accept.s === 200]);
checks.push([`warranty active`, accept.b?.data?.warranty?.active === true]);
checks.push([`warranty ~30 days`, accept.b?.data?.warranty?.daysRemaining === 30]);
const twice = await post(`/handover/${proj.id}/accept`, {});
checks.push([`double-accept rejected -> ${twice.s} (expect 409)`, twice.s === 409]);

console.log("--- CHECKS ---");
let failed = 0;
for (const [label, pass] of checks) { console.log(`${pass ? "PASS" : "FAIL"}  ${label}`); if (!pass) failed++; }
console.log(failed === 0 ? "\nALL CHECKS PASSED" : `\n${failed} FAILED`);
await prisma.$disconnect();
process.exit(failed === 0 ? 0 : 1);
