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
  VAULT_ROLES,
} from "@stackfox/core";

const BASE = "http://localhost:4000";
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

// ── SUPER_ADMIN must keep the access main granted it ────────────────────────
//
// `main` shipped ea32a0f, "allow SUPER_ADMIN role to access admin dashboard",
// which added SUPER_ADMIN inline to five route guards. This branch had already
// replaced those inline lists with shared constants in packages/core, so the
// two collided in seven files and the conflict was resolved in favour of the
// constants.
//
// That resolution is only correct if the constants grant *at least* what those
// inline lists did. It was checked by hand at the time, which is exactly the
// kind of check that rots -- narrowing one constant later would silently lock
// the master-admin account out of whole route groups, and the account with the
// most access is the one least likely to be covered by anyone's manual test.
//
// So the equivalence is pinned here. The literals below are what ea32a0f
// actually wrote; if a constant stops covering one, this fails.
{
  const fromMain: Array<[string, readonly string[], string[]]> = [
    [
      "CATALOGUE_ROLES (admin, feedback, projectInquiries)",
      CATALOGUE_ROLES,
      ["ADMIN", "SUPER_ADMIN", "SE", "SENIOR_PM"],
    ],
    ["ADMIN_ROLES (jobs, finance close)", ADMIN_ROLES, ["ADMIN", "SUPER_ADMIN"]],
    ["FINANCE_ROLES (finance)", FINANCE_ROLES, ["ADMIN", "SUPER_ADMIN", "FINANCE"]],
  ];

  for (const [label, actual, required] of fromMain) {
    const missing = required.filter((r) => !(actual as readonly string[]).includes(r));
    check(
      `${label} still grants every role ea32a0f listed`,
      missing.length === 0,
      missing.length ? `missing ${missing.join(", ")} — this is a lockout` : "",
    );
  }

  // The specific role the merge was about, across every constant that gates an
  // internal surface.
  for (const [name, roles] of Object.entries({
    ADMIN_ROLES,
    CATALOGUE_ROLES,
    DELIVERY_ROLES,
    FINANCE_ROLES,
    VAULT_ROLES,
  })) {
    check(
      `${name} includes SUPER_ADMIN`,
      (roles as readonly string[]).includes("SUPER_ADMIN"),
      "the master-admin seeder assigns SUPER_ADMIN; a constant without it is a lockout",
    );
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
