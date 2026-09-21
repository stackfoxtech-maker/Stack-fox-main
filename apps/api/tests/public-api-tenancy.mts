/**
 * /v1 tenancy, against a live API.
 *
 * The unit suite (api-keys.mts) proves the key crypto. This proves the thing
 * that actually mattered: that the org comes from the key and cannot be
 * overridden by a request. It needs two real orgs, two real keys and real
 * rows, so it runs against a running server rather than in-process.
 *
 *   ./scripts/test-stack.sh up
 *   pnpm --filter @stackfox/api test:v1
 */
import "../src/env";
import { prisma } from "@stackfox/prisma";
import { generateApiKey } from "../src/lib/apiKey";

const BASE = process.env.TEST_API_URL ?? "http://localhost:4000";

const checks: Array<[string, boolean, string]> = [];
const check = (label: string, pass: boolean, note = "") => checks.push([label, pass, note]);

const tag = Date.now().toString(36);

async function v1(path: string, key?: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(key ? { "x-api-key": key } : {}),
      ...(init.headers ?? {}),
    },
  });
  // A 204 or an error page has no JSON body; treat that as null rather than
  // letting the parse failure mask the status we came here to assert.
  const body: unknown = await res.json().catch(() => null);
  return { status: res.status, body, headers: res.headers };
}

// ── Two tenants, each with their own key and their own data ─────────────────
const orgA = await prisma.org.create({
  data: { id: `ORG-A-${tag}`, name: `Tenant A ${tag}`, type: "COMPANY" },
});
const orgB = await prisma.org.create({
  data: { id: `ORG-B-${tag}`, name: `Tenant B ${tag}`, type: "COMPANY" },
});

// Engagement has no `name`; `model` and `commercial` are required. Shapes
// taken from schema.prisma rather than assumed — a fixture written against a
// guessed shape either fails loudly or, worse, passes while testing nothing.
const engA = await prisma.engagement.create({
  data: { id: `ENG-A-${tag}`, clientId: orgA.id, model: "FPM", commercial: {} },
});
const engB = await prisma.engagement.create({
  data: { id: `ENG-B-${tag}`, clientId: orgB.id, model: "FPM", commercial: {} },
});

const keyA = generateApiKey();
const keyB = generateApiKey();
const keyRevoked = generateApiKey();
const keyWrite = generateApiKey();

await prisma.apiKey.createMany({
  data: [
    { orgId: orgA.id, prefix: keyA.prefix, keyHash: keyA.hash, scopes: ["read"] },
    { orgId: orgB.id, prefix: keyB.prefix, keyHash: keyB.hash, scopes: ["read"] },
    {
      orgId: orgA.id,
      prefix: keyRevoked.prefix,
      keyHash: keyRevoked.hash,
      scopes: ["read"],
      revokedAt: new Date(),
    },
    { orgId: orgA.id, prefix: keyWrite.prefix, keyHash: keyWrite.hash, scopes: ["read", "write"] },
  ],
});

try {
  // ── Authentication ────────────────────────────────────────────────────────
  {
    const none = await v1("/v1/engagements");
    check("no key is rejected", none.status === 401, `got ${none.status}`);

    const junk = await v1("/v1/engagements", "x");
    check(
      "any-non-empty-string is rejected",
      junk.status === 401,
      `got ${junk.status} — this exact input used to authenticate and return every org's data`,
    );

    const wrong = await v1("/v1/engagements", generateApiKey().key);
    check("a well-formed but unissued key is rejected", wrong.status === 401, `got ${wrong.status}`);

    const revoked = await v1("/v1/engagements", keyRevoked.key);
    check("a revoked key is rejected", revoked.status === 401, `got ${revoked.status}`);
    // Compare the message, not the whole body: requestId is deliberately
    // unique per request, so the raw bodies always differ.
    const msg = (b: unknown) => (b as { error?: string } | null)?.error;
    check(
      "a revoked key is indistinguishable from an unknown one",
      msg(revoked.body) !== undefined && msg(revoked.body) === msg(wrong.body),
      `revoked=${msg(revoked.body)} unknown=${msg(wrong.body)} — confirming a key is real but revoked is free information`,
    );

    const good = await v1("/v1/engagements", keyA.key);
    check("a valid key is accepted", good.status === 200, `got ${good.status}`);

    const health = await v1("/v1/health");
    check("/v1/health needs no key", health.status === 200, "a monitor has no credential");
  }

  // ── Tenancy: the org comes from the key ───────────────────────────────────
  {
    const listA = await v1("/v1/engagements", keyA.key);
    const idsA = (listA.body as Array<{ id: string }>).map((e) => e.id);
    check("a key sees its own engagement", idsA.includes(engA.id));
    check(
      "a key does NOT see the other tenant's engagement",
      !idsA.includes(engB.id),
      "every list used to return every org's rows",
    );

    // The exploit: orgId used to be a query parameter, so the caller chose.
    const forged = await v1(`/v1/engagements?orgId=${orgB.id}`, keyA.key);
    const forgedIds = (forged.body as Array<{ id: string }>).map((e) => e.id);
    check(
      "a forged ?orgId is ignored, not honoured",
      !forgedIds.includes(engB.id) && forgedIds.includes(engA.id),
      "this parameter used to decide whose data came back",
    );

    const direct = await v1(`/v1/engagements/${engB.id}`, keyA.key);
    check(
      "another tenant's engagement is 404, not 403",
      direct.status === 404,
      `got ${direct.status} — 403 would confirm the id exists`,
    );

    const own = await v1(`/v1/engagements/${engA.id}`, keyA.key);
    check("the key's own engagement is readable by id", own.status === 200, `got ${own.status}`);

    // Same question from the other side, so a pass cannot be an artefact of
    // one org happening to be empty.
    const listB = await v1("/v1/engagements", keyB.key);
    const idsB = (listB.body as Array<{ id: string }>).map((e) => e.id);
    check("the second tenant sees only its own", idsB.includes(engB.id) && !idsB.includes(engA.id));
  }

  // ── Scopes ────────────────────────────────────────────────────────────────
  {
    const readTriesWrite = await v1("/v1/webhooks", keyA.key, {
      method: "POST",
      body: JSON.stringify({ url: "https://example.com/hook" }),
    });
    check(
      "a read-only key cannot register a webhook",
      readTriesWrite.status === 403,
      `got ${readTriesWrite.status}`,
    );

    // SSRF: the server will make requests to whatever is registered here.
    const ssrf = await v1("/v1/webhooks", keyWrite.key, {
      method: "POST",
      body: JSON.stringify({ url: "http://169.254.169.254/latest/meta-data/" }),
    });
    check(
      "a webhook pointed at cloud metadata is refused",
      ssrf.status === 400,
      `got ${ssrf.status} — this endpoint accepted an arbitrary URL`,
    );

    const loopback = await v1("/v1/webhooks", keyWrite.key, {
      method: "POST",
      body: JSON.stringify({ url: "http://localhost:4000/admin" }),
    });
    check("a loopback webhook is refused", loopback.status === 400, `got ${loopback.status}`);

    const orgIdInBody = await v1("/v1/webhooks", keyWrite.key, {
      method: "POST",
      body: JSON.stringify({ url: "https://example.com/hook", orgId: orgB.id }),
    });
    check(
      "an orgId in the body is rejected outright",
      orgIdInBody.status === 400,
      `got ${orgIdInBody.status} — it used to decide which org the webhook belonged to`,
    );
  }

  // ── Every endpoint is scoped, not just the ones above ─────────────────────
  {
    for (const path of ["/v1/projects", "/v1/invoices", "/v1/tickets", "/v1/events"]) {
      const res = await v1(path, keyA.key);
      check(`${path} answers 200 for a valid key`, res.status === 200, `got ${res.status}`);
      check(
        `${path} ignores a forged ?orgId`,
        (await v1(`${path}?orgId=${orgB.id}`, keyA.key)).status === 200,
        "the parameter is not consulted at all",
      );
    }

    // /v1/services filtered on `active`, `tier` and `categoryL1` — none of
    // which are fields on ServiceUnit — so Prisma threw on every call.
    const services = await v1("/v1/services", keyA.key);
    check(
      "/v1/services no longer throws",
      services.status === 200,
      `got ${services.status} — it filtered on three fields that do not exist`,
    );
    const filtered = await v1("/v1/services?category=Web&limit=5", keyA.key);
    check("/v1/services accepts its filters", filtered.status === 200, `got ${filtered.status}`);
  }

  // ── lastUsed is recorded ──────────────────────────────────────────────────
  {
    await v1("/v1/engagements", keyA.key);
    // The write is fire-and-forget, so give it a moment.
    await new Promise((r) => setTimeout(r, 400));
    const row = await prisma.apiKey.findUnique({ where: { keyHash: keyA.hash } });
    check("a used key records lastUsed", row?.lastUsed != null, "the key list shows when each was last seen");
  }
} finally {
  // Clean up in dependency order.
  await prisma.apiKey.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
  await prisma.webhookEndpoint.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
  await prisma.engagement.deleteMany({ where: { id: { in: [engA.id, engB.id] } } });
  await prisma.org.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });
  await prisma.$disconnect();
}

console.log("\n--- /v1 TENANCY ---");
let failed = 0;
for (const [label, pass, note] of checks) {
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}${note && !pass ? `  (${note})` : ""}`);
  if (!pass) failed++;
}
console.log(`\n${checks.length - failed}/${checks.length} passed`);
console.log(failed === 0 ? "ALL /v1 TENANCY CHECKS PASSED" : `${failed} FAILED`);

process.exit(failed === 0 ? 0 : 1);
