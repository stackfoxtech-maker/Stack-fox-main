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
 *   pnpm --filter @stackfox/api exec tsx tests/cron-consolidation.mts
 */
import "../src/env";

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

import { SCHEDULE_IDS } from "../src/lib/scheduler";
import {
  registerCron,
  dispatchCron,
  registeredCronIds,
} from "../src/workers/cron/registry";
import { QUEUE } from "../src/lib/queue";

// Importing each handler module runs its registerCron() call.
import "../src/workers/slaCron";
import "../src/workers/reconciliation";
import "../src/workers/dunning";
import "../src/workers/renewalScanner";
import "../src/workers/harvestReminder";
import "../src/workers/timesheetCompiler";
import "../src/workers/archiveRetention";
import "../src/workers/softex";
import "../src/workers/salesFollowup";

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
  scheduled.length === registered.length && scheduled.length === 9,
);

// ── 2. dispatch routes by job name ──────────────────────────────────────────
let probeRuns = 0;
registerCron("__probe__", async () => {
  probeRuns++;
});
await dispatchCron({ name: "__probe__", data: {} } as any);
check("dispatchCron invokes the handler for a known job name", probeRuns === 1);

// wrong name must not run the probe and must not throw
let threw = false;
try {
  await dispatchCron({ name: "__does_not_exist__", data: {} } as any);
} catch {
  threw = true;
}
check("dispatchCron ignores an unknown job name without throwing", !threw && probeRuns === 1);

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
check(
  "QUEUE has 11 entries (10 direct + cron)",
  queueKeys.length === 11,
);

// ── 5. cron patterns are well-formed 5-field expressions ────────────────────
// Re-derive the patterns from the module's own source so a typo is caught.
const here = dirname(fileURLToPath(import.meta.url));
const schedulerSrc = readFileSync(resolve(here, "../src/lib/scheduler.ts"), "utf8");
const patternMatches = [...schedulerSrc.matchAll(/pattern:\s*"([^"]+)"/g)].map((m) => m[1]);
check(`found ${scheduled.length} cron patterns in scheduler.ts`, patternMatches.length === 9);
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
