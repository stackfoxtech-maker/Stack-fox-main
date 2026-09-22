/**
 * Cron-queue consolidation wiring check.
 *
 * The nine cron-shaped workers used to each own a Queue + Worker; they now
 * register a handler keyed by schedule id and one worker drains the shared
 * `cron` queue. The failure mode that check guards against is drift between the
 * schedule id in lib/scheduler.ts and the id passed to registerCron() in the
 * worker file — a mismatch means that job fires forever with nothing to run it,
 * exactly the silent-subsystem class of bug the queue-name map was introduced
 * to kill.
 *
 * Loads env + the worker modules (which pulls in lib/queue and therefore a
 * Redis connection), like the other suites. Does NOT need the HTTP API.
 *
 * ── Why the registry is loaded from dist/ ───────────────────────────────────
 *
 * The schedule-to-handler assertions require that the registry the worker
 * modules write to is the SAME module instance this file reads from. That is
 * not guaranteed across the module boundary here: this file is `.mts`, so ESM,
 * while apps/api/src compiles as CommonJS ("module": "CommonJS"). Whether the
 * two end up sharing one instance depends on how the runtime bridges CJS and
 * ESM, and it differs by Node version — on Node 22 they share, on Node 20 they
 * did not, and the registry read here came back with zero handlers while the
 * worker modules had populated their own copy.
 *
 * Node 20 is the version that matters: Dockerfile.server is node:20-slim, so
 * that is what production runs, and CI pins 20 to match. A local Node 22 pass
 * was therefore false confidence, not a green light.
 *
 * Loading through dist/ removes the question. It is all CommonJS, one module
 * system, one registry instance — and it is the artifact the container
 * actually executes (`node dist/workers/index.js`), so this now checks the
 * thing that ships rather than a transpiled-on-the-fly approximation.
 *
 * Requires a build first; CI builds before running the suites.
 *
 *   pnpm --filter @stackfox/api build
 *   pnpm --filter @stackfox/api exec tsx tests/cron-consolidation.mts
 */
import "../src/env";

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

import { QUEUE } from "../src/lib/queue";

const requireCjs = createRequire(import.meta.url);
const distDir = resolve(dirname(fileURLToPath(import.meta.url)), "../dist");

if (!existsSync(resolve(distDir, "workers/cron/registry.js"))) {
  console.log(
    "\nFAIL  dist/ is missing — run `pnpm --filter @stackfox/api build` first.\n" +
      "      This suite checks the built artifact on purpose; see the header.\n",
  );
  process.exit(1);
}

type CronRegistry = {
  registerCron: (id: string, handler: () => Promise<void>) => void;
  dispatchCron: (job: unknown) => Promise<void>;
  registeredCronIds: () => string[];
};

const { registerCron, dispatchCron, registeredCronIds } = requireCjs(
  resolve(distDir, "workers/cron/registry.js"),
) as CronRegistry;

const { SCHEDULE_IDS } = requireCjs(resolve(distDir, "lib/scheduler.js")) as {
  SCHEDULE_IDS: readonly string[];
};

// Requiring each handler module runs its registerCron() call, into the same
// CommonJS registry instance destructured above.
for (const m of [
  "slaCron",
  "reconciliation",
  "dunning",
  "renewalScanner",
  "harvestReminder",
  "timesheetCompiler",
  "archiveRetention",
  "softex",
  "salesFollowup",
  "healthAlert",
]) {
  requireCjs(resolve(distDir, `workers/${m}.js`));
}

const checks: Array<[string, boolean]> = [];
const check = (label: string, ok: boolean) => checks.push([label, ok]);

// ── 1. schedule ids ⇔ registered handler ids ────────────────────────────────
const scheduled = [...SCHEDULE_IDS].sort();
const registered = registeredCronIds();

for (const id of scheduled) {
  check(`schedule "${id}" has a registered handler`, registered.includes(id));
}
for (const id of registered) {
  check(`handler "${id}" has a matching schedule`, scheduled.includes(id));
}
check(
  `exactly ${scheduled.length} schedules, ${registered.length} handlers`,
  scheduled.length === registered.length && scheduled.length === 10,
);

// ── 2. dispatch routes by job name ──────────────────────────────────────────
let probeRuns = 0;
registerCron("__probe__", async () => {
  probeRuns++;
});
await dispatchCron({ name: "__probe__", data: {} });
check("dispatchCron invokes the handler for a known job name", probeRuns === 1);

// wrong name must not run the probe and must not throw
let threw = false;
try {
  await dispatchCron({ name: "__does_not_exist__", data: {} });
} catch {
  threw = true;
}
check(
  "dispatchCron ignores an unknown job name without throwing",
  !threw && probeRuns === 1,
);

// ── 3. duplicate registration is rejected ───────────────────────────────────
let dupThrew = false;
try {
  registerCron("sla-sweep", async () => {});
} catch {
  dupThrew = true;
}
check("registerCron rejects a duplicate id", dupThrew);

// ── 4. QUEUE map: retired names gone, cron present ──────────────────────────
const RETIRED = [
  "reconciliation",
  "dunning",
  "slaCron",
  "timesheetCompiler",
  "renewalScanner",
  "softex",
  "harvestReminder",
  "archiveRetention",
  "salesFollowup",
];
const queueKeys = Object.keys(QUEUE);
for (const k of RETIRED) {
  check(`QUEUE no longer defines "${k}"`, !queueKeys.includes(k));
}
check('QUEUE defines "cron"', queueKeys.includes("cron"));
check("QUEUE has 11 entries (10 direct + cron)", queueKeys.length === 11);

// ── 5. cron patterns are well-formed 5-field expressions ────────────────────
// Re-derive the patterns from the module's own source so a typo is caught.
const here = dirname(fileURLToPath(import.meta.url));
const schedulerSrc = readFileSync(resolve(here, "../src/lib/scheduler.ts"), "utf8");
const patternMatches = [...schedulerSrc.matchAll(/pattern:\s*"([^"]+)"/g)].map(
  (m) => m[1],
);
check(
  `found ${scheduled.length} cron patterns in scheduler.ts`,
  patternMatches.length === 10,
);
for (const p of patternMatches) {
  const fields = p.trim().split(/\s+/);
  check(`pattern "${p}" has 5 fields`, fields.length === 5);
}

// ── report ─────────────────────────────────────────────────────────────────
console.log("\ncron-consolidation");
let failed = 0;
for (const [label, ok] of checks) {
  console.log(`  ${ok ? "✓" : "✗"} ${label}`);
  if (!ok) failed++;
}
console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
process.exit(failed ? 1 : 0);
