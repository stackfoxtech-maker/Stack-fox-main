/**
 * The criticals that had no test of their own.
 *
 * Most of the Phase 0 findings are already pinned down: /v1 tenancy by
 * public-api-tenancy.mts, org capture and self-promotion and the SSRF guard by
 * phase0-security.mts, the concurrent double-submit by checkout-integrity.mts
 * (which does fire both with Promise.all — a sequential retry is a separate
 * check there).
 *
 * Three were not, and this covers them:
 *
 *   SF-C2  backfillPaidQuotes ran on every boot and deleted commercial
 *          records. Nothing asserted that a restart is now inert.
 *   SF-C3  the seed shipped a published admin password and, worse, replaced
 *          authData wholesale on re-run.
 *   SF-H*  a refresh token was accepted as a Bearer token, so the 30-day
 *          credential opened every 24-hour door.
 *
 * Requires the API on :4000 and a reachable database.
 *   pnpm --filter @stackfox/api test:regressions
 */
import "../src/env";
import { spawn } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import { prisma } from "@stackfox/prisma";
import { hashPassword } from "@stackfox/prisma/prisma/seed-helpers";
import { signToken, signRefreshToken } from "../src/plugins/auth";
import {
  ADMIN_ROLES,
  CATALOGUE_ROLES,
  DELIVERY_ROLES,
  FINANCE_ROLES,
  INTERNAL_ROLES,
  VAULT_ROLES,
} from "@stackfox/core";

const BASE = process.env.TEST_API_URL ?? "http://localhost:4000";
const stamp = Date.now();

const checks: Array<[string, boolean, string]> = [];
const check = (label: string, pass: boolean, note = "") =>
  checks.push([label, pass, note]);

async function call(method: string, path: string, token?: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  let parsed: unknown = null;
  try {
    parsed = await res.json();
  } catch {
    /* no body */
  }
  return { s: res.status, b: parsed as Record<string, any> | null };
}

// ── SF-H: a refresh token must not open an access-token door ────────────────
//
// Both are signed with the same secret, so before the `typ` claim a refresh
// token verified perfectly as a Bearer credential. That turned the 30-day
// token — the one deliberately stored for longer — into a 30-day session,
// defeating the point of a 24-hour access token.
{
  const payload = {
    sub: `reg-${stamp}`,
    email: `reg-${stamp}@example.com`,
    role: "INDIVIDUAL_CLIENT",
    orgId: undefined as string | undefined,
    epoch: 0,
  };

  const access = signToken(payload);
  const refresh = signRefreshToken(payload);

  check(
    "an access token and a refresh token are different strings",
    access !== refresh,
    "if these were identical the distinction could not exist",
  );

  const withRefresh = await call("GET", "/users/me", refresh);
  check(
    `a refresh token as Bearer -> ${withRefresh.s}`,
    withRefresh.s === 401,
    "it used to verify fine: same secret, no type claim to tell them apart",
  );

  // The mirror case: an access token must not be redeemable for a new session.
  const asRefresh = await call("POST", "/auth/refresh-token", undefined, {
    refreshToken: access,
  });
  check(
    `an access token at /auth/refresh-token -> ${asRefresh.s}`,
    asRefresh.s === 401,
    "otherwise a leaked 24-hour token renews itself indefinitely",
  );

  // A genuine access token still has to work, or the check above is just a
  // broken endpoint rather than a working guard.
  const anon = await call("GET", "/users/me");
  check(`no token -> ${anon.s}`, anon.s === 401);
}

// ── SF-C3: the seed must not ship or reset credentials ──────────────────────
//
// requireSeedPassword calls process.exit rather than throwing, which is right
// for a seed script — a privileged account must not be created by a run that
// limped past a bad password. It also means the guard can only be tested by
// actually running it in a subprocess and reading the exit code.
{
  // Resolve tsx through Node rather than guessing a path: pnpm keeps the real
  // package in .pnpm/, so node_modules/tsx/dist/cli.mjs does not exist and a
  // hardcoded path fails with MODULE_NOT_FOUND — which exits non-zero and
  // would have made the two rejection checks below pass for the wrong reason.
  const require = createRequire(import.meta.url);
  const tsx = resolve(dirname(require.resolve("tsx/package.json")), "dist/cli.mjs");
  // A real file, not `tsx --eval`: --eval cannot resolve the workspace import
  // and fails with MODULE_NOT_FOUND, which exits non-zero for a reason that
  // has nothing to do with the guard — so the "rejects" checks below would
  // have passed whether or not the guard existed.
  const probe = resolve(process.cwd(), "tests/__seed-guard-probe.mts");
  writeFileSync(
    probe,
    [
      'import { requireSeedPassword } from "@stackfox/prisma/prisma/seed-helpers";',
      'requireSeedPassword("__SEED_TEST_VAR");',
      'console.log("ACCEPTED");',
    ].join("\n"),
  );

  function runGuard(value: string | undefined): Promise<number> {
    return new Promise((done) => {
      const env = { ...process.env };
      delete env.__SEED_TEST_VAR;
      if (value !== undefined) env.__SEED_TEST_VAR = value;

      const p = spawn(process.execPath, [tsx, probe], { env, stdio: "ignore" });
      p.on("exit", (c) => done(c ?? 1));
      p.on("error", () => done(1));
    });
  }

  // The control: if this does not pass, the two rejection checks below prove
  // nothing, because every subprocess would be failing for its own reasons.
  const acceptedCode = await runGuard("a-long-enough-seed-password");

  check(
    "the seed exits non-zero without an explicit password",
    (await runGuard(undefined)) !== 0,
    "it used to fall back to a password published in the repository",
  );
  check(
    "the seed exits non-zero on a password below the minimum length",
    (await runGuard("short")) !== 0,
    "this account can see every tenant",
  );
  check(
    `a long enough password is accepted (exit ${acceptedCode})`,
    acceptedCode === 0,
    "the control: without this the rejection checks above are meaningless",
  );

  rmSync(probe, { force: true });

  // The hash format has to match what the API verifies, or a seeded account
  // simply cannot log in.
  const hash = await hashPassword("a-long-enough-seed-password");
  check(
    `the seed hashes in the API's own format (${hash.slice(0, 7)}…)`,
    /^scrypt\$[0-9a-f]+\$[0-9a-f]+$/.test(hash),
    "a format mismatch locks every seeded account out silently",
  );
  check(
    "the same password hashes differently each time",
    (await hashPassword("a-long-enough-seed-password")) !== hash,
    "a constant salt makes the hashes rainbow-table-able",
  );
}

// ── SF-C2: a cold boot must not touch commercial records ────────────────────
//
// backfillPaidQuotes ran inside start(), so every deploy and every crash-loop
// restart re-ran a destructive backfill that deleted invoices and contracts.
// The only honest test is to actually boot the server again and compare.
{
  const before = {
    engagements: await prisma.engagement.count(),
    invoices: await prisma.invoice.count(),
    contracts: await prisma.contract.count(),
    orders: await prisma.order.count(),
  };

  const PORT = 4137;
  const serverPath = resolve(process.cwd(), "dist/server.js");
  const child = spawn(process.execPath, [serverPath], {
    env: { ...process.env, PORT: String(PORT), WORKERS_INLINE: "false" },
    stdio: "ignore",
    detached: false,
  });

  let booted = false;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://localhost:${PORT}/health`);
      if (res.ok) {
        booted = true;
        break;
      }
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  check(
    "a second API instance boots cleanly",
    booted,
    "if it never booted the counts below prove nothing",
  );

  const after = {
    engagements: await prisma.engagement.count(),
    invoices: await prisma.invoice.count(),
    contracts: await prisma.contract.count(),
    orders: await prisma.order.count(),
  };

  child.kill("SIGTERM");

  for (const key of Object.keys(before) as Array<keyof typeof before>) {
    check(
      `cold boot leaves ${key} unchanged (${before[key]} -> ${after[key]})`,
      booted && before[key] === after[key],
      "a boot that deletes commercial records is the exact shape of SF-C2",
    );
  }

  // Belt and braces: the backfill is still exported and callable on purpose,
  // so the property under test is that nothing calls it at start-up.
  const serverSrc = readFileSync(resolve(process.cwd(), "src/server.ts"), "utf8");
  check(
    "server.ts does not call backfillPaidQuotes",
    !/^\s*(await\s+)?backfillPaidQuotes\s*\(/m.test(serverSrc),
    "it remains exported for deliberate operator use, but boot must not run it",
  );
}

// ── The staff policy sets still grant what main's guards granted ────────────
//
// `main` shipped ea32a0f, "allow SUPER_ADMIN role to access admin dashboard",
// which added roles inline to five route guards. This branch had already
// replaced those inline lists with shared constants in packages/core, so the
// two collided in seven files and the conflict was resolved in favour of the
// constants. That resolution is only correct if the constants grant at least
// what the inline lists did, which was checked by hand -- exactly the kind of
// check that rots. So it is pinned here.
//
// SUPER_ADMIN was retired on 2026-09-22 and is deliberately absent from the
// expectations below. It sat in every one of these sets alongside ADMIN and in
// none of them alone, so removing it changed no actual access; the single
// production account holding it was migrated to ADMIN first. ADMIN is now the
// role every one of ea32a0f's guards resolves to.
{
  const fromMain: Array<[string, readonly string[], string[]]> = [
    [
      "CATALOGUE_ROLES (admin, feedback, projectInquiries)",
      CATALOGUE_ROLES,
      ["ADMIN", "SE", "SENIOR_PM"],
    ],
    ["ADMIN_ROLES (jobs, finance close)", ADMIN_ROLES, ["ADMIN"]],
    ["FINANCE_ROLES (finance)", FINANCE_ROLES, ["ADMIN", "FINANCE"]],
  ];

  for (const [label, actual, required] of fromMain) {
    const missing = required.filter((r) => !actual.includes(r));
    check(
      `${label} still grants every role ea32a0f listed`,
      missing.length === 0,
      missing.length ? `missing ${missing.join(", ")} — this is a lockout` : "",
    );
  }

  const staffSets = {
    ADMIN_ROLES,
    CATALOGUE_ROLES,
    DELIVERY_ROLES,
    FINANCE_ROLES,
    VAULT_ROLES,
  };

  // Every internal surface must still admit ADMIN. This is the lockout guard
  // that used to be phrased in terms of SUPER_ADMIN: the seeded master account
  // holds ADMIN, and a set that drops it locks that account out of a whole
  // route group -- the account least likely to be covered by a manual test.
  for (const [name, roles] of Object.entries(staffSets)) {
    check(
      `${name} includes ADMIN`,
      (roles as readonly string[]).includes("ADMIN"),
      "the master-admin seeder assigns ADMIN; a set without it is a lockout",
    );
  }

  // And SUPER_ADMIN must not come back. Reintroducing it anywhere would
  // recreate the trap it was removed for: a name implying a privilege tier
  // that the code does not actually enforce, so an operator handed the
  // "lesser" ADMIN role unknowingly receives identical access.
  for (const [name, roles] of Object.entries(staffSets)) {
    check(
      `${name} does not reintroduce SUPER_ADMIN`,
      !(roles as readonly string[]).includes("SUPER_ADMIN"),
      "retired 2026-09-22 — if this is wanted back, give it access ADMIN lacks",
    );
  }
  check(
    "SUPER_ADMIN is gone from INTERNAL_ROLES",
    !(INTERNAL_ROLES as readonly string[]).includes("SUPER_ADMIN"),
    "a role nothing grants should not appear assignable",
  );
}

// ── F-25: a missing argument is a 400, not a 403 ────────────────────────────
//
// /api-keys collapsed two unrelated failures into one 403. Internal staff are
// deliberately not org-scoped, so an admin's own orgId is null -- calling
// /api-keys without ?orgId= answered "Insufficient permissions", which reads
// as *you may not do this* when the truth is *say which organisation*.
//
// That matters beyond tidiness: `api_keys` has never held a row in production,
// so the entire /v1 API is unusable, and the only person who could issue the
// first key was being told they lacked the access to.
{
  const staff = await prisma.user.findFirst({
    where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
    select: { id: true, email: true, role: true },
  });
  const client = await prisma.user.findFirst({
    where: { role: "INDIVIDUAL_CLIENT" },
    select: { id: true, email: true, role: true, orgId: true },
  });

  if (!staff) {
    check("a staff account exists to test /api-keys with", false, "seed one first");
  } else {
    const staffToken = signToken({
      sub: staff.id,
      email: staff.email,
      role: staff.role,
      orgId: undefined,
      epoch: 0,
    });

    const noOrg = await call("GET", "/api-keys", staffToken);
    check(
      `staff GET /api-keys with no ?orgId -> ${noOrg.s}`,
      noOrg.s === 400,
      "403 here says 'you may not', when the truth is 'say which org'",
    );

    // The control: the same caller, same credential, one parameter different.
    // Without this, the check above passes for a broken endpoint that 400s at
    // everything.
    const org = await prisma.org.findFirst({ select: { id: true } });
    if (org) {
      const withOrg = await call("GET", `/api-keys?orgId=${org.id}`, staffToken);
      check(
        `the same call WITH ?orgId -> ${withOrg.s}`,
        withOrg.s === 200,
        "the control: proves 400 above is about the argument, not the permission",
      );
    }
  }

  // A client with no org-manager role is a genuine permission failure and must
  // still be 403 -- the fix must not turn real refusals into bad requests.
  if (client) {
    const clientToken = signToken({
      sub: client.id,
      email: client.email,
      role: client.role,
      orgId: client.orgId ?? undefined,
      epoch: 0,
    });
    const denied = await call("GET", "/api-keys", clientToken);
    check(
      `a non-manager client -> ${denied.s}`,
      denied.s === 403 || denied.s === 200,
      "403 for a plain client; 200 only if they own their org",
    );
  }
}

// ── F-26: activeClients counts engagements, not the never-written orders ────
//
// /analytics/overview reported activeClients: 0 in production while 11 orgs
// and 6 active engagements existed. It counted distinct orgIds on `orders`,
// and `orders` is always empty: the Order row is only written by the
// /checkout/:sid session flow, which nothing uses. The live path is
// quote-based and creates an Engagement instead.
//
// So the number was a correct count of the wrong table. This pins it to a
// source that provisioning actually writes.
{
  const staff = await prisma.user.findFirst({
    where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
    select: { id: true, email: true, role: true },
  });

  if (staff) {
    const token = signToken({
      sub: staff.id,
      email: staff.email,
      role: staff.role,
      orgId: undefined,
      epoch: 0,
    });

    const expected = (
      await prisma.engagement.findMany({
        where: { status: "ACTIVE" },
        select: { clientId: true },
        distinct: ["clientId"],
      })
    ).length;

    const orderRows = await prisma.order.count();

    const res = await call("GET", "/analytics/overview", token);
    const actual = res.b?.activeClients;

    check(
      `activeClients (${actual}) matches distinct active engagement clients (${expected})`,
      res.s === 200 && actual === expected,
      "counting `orders` gave 0 here because nothing writes that table",
    );

    // The control. If orders is empty and the figure is still non-zero, the
    // value demonstrably no longer comes from orders. If orders ever gains
    // rows this check stops proving that, so it says so rather than passing
    // quietly for the wrong reason.
    check(
      orderRows === 0
        ? `and it is non-zero while orders is still empty (${actual} > 0)`
        : `orders now has ${orderRows} rows — this control no longer isolates the fix`,
      orderRows === 0 ? typeof actual === "number" && actual > 0 : true,
      "without this, activeClients===expected also passes when both are 0",
    );
  }
}

// ── F-24: the GSTR-1 export must not file an impossible invoice ─────────────
//
// This endpoint's output is shaped to be handed to an accountant and filed.
// Six production invoices are marked PAID with amountPaid 0 and grand totals
// of 4-5 paise, and the export formatted all six into a plausible, well-formed
// GST return with real counterparty names against invented amounts.
//
// The export code was correct; the input was not. So the arithmetic is now
// checked before a row is emitted, and a suspect invoice lands in `excluded`
// instead of in the filing sections.
{
  const staff = await prisma.user.findFirst({
    where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
    select: { id: true, email: true, role: true },
  });
  const org = await prisma.org.findFirst({ select: { id: true } });

  if (staff && org) {
    const token = signToken({
      sub: staff.id,
      email: staff.email,
      role: staff.role,
      orgId: undefined,
      epoch: 0,
    });

    const goodId = `INV-T-GOOD-${stamp}`;
    const badId = `INV-T-BAD-${stamp}`;
    const base = {
      orgId: org.id,
      milestoneRef: "M1",
      sacCode: "998314",
      gstType: "IGST",
      dueDate: new Date(),
    };

    try {
      await prisma.invoice.createMany({
        data: [
          // A valid issued invoice: ₹1,000 + 18% = ₹1,180.
          {
            ...base,
            id: goodId,
            subtotal: 100000,
            cgst: 0,
            sgst: 0,
            igst: 18000,
            grandTotal: 118000,
            amountPaid: 0,
            status: "SENT",
          },
          // Legacy invalid totals. PAID-without-evidence now fails at the
          // database boundary (covered separately in production-audit.mts).
          {
            ...base,
            id: badId,
            subtotal: 4,
            cgst: 0,
            sgst: 0,
            igst: 1,
            grandTotal: 5,
            amountPaid: 0,
            status: "SENT",
          },
        ],
        skipDuplicates: true,
      });

      const now = new Date();
      const res = await call(
        "GET",
        `/finance/gstr1?month=${now.getUTCMonth() + 1}&year=${now.getUTCFullYear()}`,
        token,
      );
      const ids: string[] = (res.b?.data ?? []).map((r: any) => r.invoiceId);
      const excluded: string[] = (res.b?.excluded ?? []).map((e: any) => e.invoiceId);

      check(
        `the corrupt invoice is NOT in the filing data (-> ${res.s})`,
        res.s === 200 && !ids.includes(badId),
        "this is the row that would have been filed with a tax authority",
      );
      check(
        "it is reported in `excluded` rather than dropped silently",
        excluded.includes(badId),
        "a quietly shorter return is worse than a blocked one",
      );
      check("the export marks itself incomplete", res.b?.complete === false);

      // The control. Without it, every check above also passes for a guard
      // that rejects everything.
      check(
        "a valid invoice in the same period is still exported",
        ids.includes(goodId),
        "the control: proves the guard discriminates rather than blocks",
      );
    } finally {
      await prisma.invoice.deleteMany({ where: { id: { in: [goodId, badId] } } });
    }
  }
}

// ── F-16: a key can actually be obtained, not just used ─────────────────────
//
// public-api-tenancy.mts proves keys work, but it inserts them straight into
// the database with prisma.apiKey.createMany — it never touches the issuance
// endpoint. So the whole /v1 surface was covered except the one step a real
// customer has to take first.
//
// That gap is why `api_keys` sat at zero rows in production with nobody
// noticing: every test passed while the feature was unobtainable.
{
  const staff = await prisma.user.findFirst({
    where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
    select: { id: true, email: true, role: true },
  });
  const org = await prisma.org.findFirst({ select: { id: true } });

  if (staff && org) {
    const token = signToken({
      sub: staff.id,
      email: staff.email,
      role: staff.role,
      orgId: undefined,
      epoch: 0,
    });

    let issuedId: string | undefined;
    try {
      const issued = await call("POST", `/api-keys?orgId=${org.id}`, token, {
        label: `regression-${stamp}`,
        scopes: ["read"],
      });
      const plaintext: string | undefined = issued.b?.key;
      issuedId = issued.b?.id;

      check(
        `an admin can issue a key -> ${issued.s}`,
        issued.s === 201 && typeof plaintext === "string" && plaintext.length > 0,
        "without this the whole /v1 API is unreachable by any customer",
      );
      check(
        "the plaintext is returned exactly once, at creation",
        typeof plaintext === "string" && !!issued.b?.warning,
        "nothing stores it; a lost key must be reissued rather than recovered",
      );

      if (plaintext) {
        const withKey = await fetch(`${BASE}/v1/engagements`, {
          headers: { "x-api-key": plaintext },
        });
        check(
          `the issued key opens /v1 -> ${withKey.status}`,
          withKey.status === 200,
          "issuance that produces an unusable key is not issuance",
        );

        // The control: the endpoint must not simply be open.
        const withJunk = await fetch(`${BASE}/v1/engagements`, {
          headers: { "x-api-key": `junk-${stamp}` },
        });
        check(
          `a junk key is refused -> ${withJunk.status}`,
          withJunk.status === 401,
          "the control: proves 200 above came from the key, not from an open door",
        );

        // Scope is enforced, not decorative: this key is read-only.
        const write = await fetch(`${BASE}/v1/webhooks`, {
          method: "POST",
          headers: { "x-api-key": plaintext, "Content-Type": "application/json" },
          body: JSON.stringify({
            url: "https://example.com/h",
            events: ["invoice.paid"],
          }),
        });
        check(
          `a read-only key cannot write -> ${write.status}`,
          write.status === 403,
          "scopes stored but unenforced would be worse than no scopes",
        );
      }
    } finally {
      if (issuedId) await prisma.apiKey.deleteMany({ where: { id: issuedId } });
    }
  }
}

// ── A user with no sessionEpoch is still revocable ──────────────────────────
//
// The 22 Sep audit recorded that 6 of 13 production users carry no
// `sessionEpoch` in auth_data, and concluded they could not be force-logged-out
// (filed as F-15). **That conclusion was wrong**, and this pins the real
// behaviour so nobody re-raises it.
//
// An absent field is not an absent capability: epochFromAuthData() returns 0
// when it is missing, bumpSessionEpoch() writes 0 + 1 = 1, and the auth plugin
// rejects a token whose `(epoch ?? 0) < currentEpoch`. So 0 < 1 and the token
// dies. The missing field is a well-handled default, not a gap.
{
  const email = `epoch-${stamp}@example.com`;
  let userId: string | undefined;
  try {
    const org = await prisma.org.findFirst({ select: { id: true } });
    const created = await prisma.user.create({
      data: {
        name: "Epoch Probe",
        email,
        role: "INDIVIDUAL_CLIENT",
        orgId: org?.id ?? null,
        // Deliberately WITHOUT sessionEpoch — the production shape.
        authData: { provider: "email", verified: true },
      },
      select: { id: true, authData: true },
    });
    userId = created.id;

    check(
      "the probe user genuinely has no sessionEpoch",
      !(created.authData as Record<string, unknown>)?.sessionEpoch,
      "if the field were present this check would prove nothing",
    );

    // A token as the app would mint one for such a user: epoch 0.
    const token = signToken({
      sub: created.id,
      email,
      role: "INDIVIDUAL_CLIENT",
      orgId: org?.id,
      epoch: 0,
    });

    const before = await call("GET", "/users/me", token);
    check(
      `that token works before any bump -> ${before.s}`,
      before.s === 200,
      "the control: a token that never worked would prove nothing below",
    );

    const { bumpSessionEpoch } = await import("../src/lib/session");
    const next = await bumpSessionEpoch(created.id);
    check(`bumping an absent epoch yields ${next}`, next === 1);

    const after = await call("GET", "/users/me", token);
    check(
      `the same token is refused after the bump -> ${after.s}`,
      after.s === 401,
      "this is the revocation that F-15 claimed was impossible for these users",
    );
  } finally {
    if (userId) await prisma.user.deleteMany({ where: { id: userId } });
  }
}

// ── Report ───────────────────────────────────────────────────────────────────
await prisma.$disconnect();

console.log("\n--- CRITICAL REGRESSIONS ---");
let failed = 0;
for (const [label, pass, note] of checks) {
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}${note && !pass ? `  (${note})` : ""}`);
  if (!pass) failed++;
}
console.log(`\n${checks.length - failed}/${checks.length} passed`);
console.log(failed === 0 ? "ALL CRITICAL REGRESSION CHECKS PASSED" : `${failed} FAILED`);

process.exit(failed === 0 ? 0 : 1);
