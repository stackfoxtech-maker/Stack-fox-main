/**
 * Runs every regression suite and reports a combined result.
 *
 * The `test` script used to chain the suites with `&&`, so the first failure
 * aborted the run and the remaining suites (reports-handover, staff-surfaces,
 * cart) never executed — a red suite masked whatever else had regressed. This
 * runs all of them regardless and exits non-zero if any failed.
 *
 * Requires the API on :4000 (see individual suite headers).
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import Redis from "ioredis";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
// Resolve the tsx CLI so each suite runs the same way `tsx <file>` would,
// independent of Node's loader-flag spelling across versions.
const tsxCli = join(dirname(require.resolve("tsx/package.json")), "dist", "cli.mjs");

const SUITES = [
  "cron-consolidation.mts",
  "tenant-isolation.mts",
  "access-control.mts",
  "reports-handover.mts",
  "staff-surfaces.mts",
  "cart.mts",
  "phase0-security.mts",
  "checkout-integrity.mts",
  "document-integrity.mts",
  "provisioning-parity.mts",
  "money-and-ids.mts",
  "observability.mts",
  "validation.mts",
  "api-keys.mts",
  "public-api-tenancy.mts",
  "critical-regressions.mts",
  "catalogue-cache.mts",
  "transactions.mts",
  "quote-pricing.mts",
  "production-audit.mts",
  "mutation-smoke.mts",
  "signup-form.mts",
  "payment-gateway-unavailable.mts",
  "blog-publish.mts",
  "invoice-access.mts",
  "messaging-team.mts",
  "tier-pricing.mts",
  "milestone-flow.mts",
];

function run(file: string): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [tsxCli, join(here, file)], {
      stdio: "inherit",
      env: process.env,
    });
    child.on("exit", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  });
}

// Isolate limiter counters between suites, keeping production limits intact
// within each suite (including the brute-force/rate-limit assertions).
// Refuse remote hosts and non-test databases before any fixture or Redis write.
const database = new URL(process.env.DATABASE_URL ?? "");
const redisUrl = new URL(process.env.REDIS_URL ?? "");
const local = (host: string) => ["localhost", "127.0.0.1", "[::1]"].includes(host);
if (
  !local(database.hostname) ||
  !/^\/stackfox_(test|audit_)/.test(database.pathname) ||
  !local(redisUrl.hostname)
) {
  throw new Error("Regression suites require a dedicated local test database and Redis");
}
const limiterRedis = new Redis(redisUrl.toString(), { maxRetriesPerRequest: 1 });
async function resetLimiter() {
  let cursor = "0";
  do {
    const [next, keys] = await limiterRedis.scan(
      cursor,
      "MATCH",
      "fastify-rate-limit-*",
      "COUNT",
      100,
    );
    cursor = next;
    if (keys.length) await limiterRedis.del(...keys);
  } while (cursor !== "0");
}
const results: Array<{ suite: string; code: number }> = [];
try {
  for (const suite of SUITES) {
    console.log(`\n─── ${suite} ───`);
    await resetLimiter();
    results.push({ suite, code: await run(suite) });
  }
} finally {
  await limiterRedis.quit();
}

console.log("\n═══ Summary ═══");
for (const r of results) {
  console.log(`${r.code === 0 ? "PASS" : "FAIL"}  ${r.suite}`);
}

const failed = results.filter((r) => r.code !== 0);
if (failed.length) {
  console.error(`\n${failed.length}/${results.length} suite(s) failed`);
  process.exit(1);
}
console.log(`\nAll ${results.length} suites passed`);
