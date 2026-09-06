import { queues } from "./queue";
import { redis } from "./redis";

/**
 * Periodic-job registration.
 *
 * Nine workers are cron-shaped — they scan the database and act, taking no
 * per-job input (SLA breaches, dunning, reconciliation, renewal scanning,
 * retention, timesheet compilation…). Nothing ever enqueued work into them, so
 * they sat idle forever: subscribed, never triggered.
 *
 * BullMQ job schedulers fix that. `upsertJobScheduler` is declarative and
 * idempotent — re-running it on every boot reconciles the schedule rather than
 * stacking duplicates — and the repeat metadata lives in Redis, so exactly one
 * worker in a horizontally-scaled fleet runs each occurrence.
 *
 * All nine schedules target ONE `cron` queue (see workers/cron/). The BullMQ
 * job name is the schedule `id`, which must match a `registerCron(id, …)` call.
 *
 * Cron expressions are 5-field (min hour dom mon dow) and evaluated in the
 * timezone below. IST matches where the business and its filings sit.
 */
const TZ = process.env.SCHEDULER_TZ ?? "Asia/Kolkata";

interface Schedule {
  /** Stable id — reused across boots (updates, not duplicates), emitted as the
   *  BullMQ job name, and MUST match a registerCron(id) call in workers/cron. */
  id: string;
  pattern: string;
  /** Optional payload handed to the handler for each occurrence. */
  data?: Record<string, unknown>;
}

const SCHEDULES: Schedule[] = [
  // SLA response-target breaches — needs to be tight or the first-response
  // clock is meaningless.
  { id: "sla-sweep", pattern: "*/15 * * * *" },

  // Invoice lifecycle: SENT past due date -> OVERDUE, then dunning notices.
  // Order matters, so reconciliation runs an hour ahead of dunning.
  { id: "invoice-reconcile", pattern: "0 2 * * *" },
  { id: "dunning-run", pattern: "0 3 * * *" },

  // Engagements expiring within 30 days -> RENEWAL_DUE.
  { id: "renewal-scan", pattern: "0 4 * * *" },

  // Draft timesheets left sitting -> reminder to the delivery team.
  { id: "harvest-reminder", pattern: "0 9 * * 1-5" },

  // Fresh weekly timesheet shells for every active T&M / retainer / dedicated
  // engagement, first thing Monday.
  { id: "timesheet-weekly", pattern: "30 0 * * 1" },

  // Storage retention sweep for files past FILE_RETENTION_DAYS.
  { id: "archive-retention", pattern: "0 1 * * *" },

  // SOFTEX (RBI software-export filing) for the quarter that just closed —
  // 05:00 on the first day of Jan / Apr / Jul / Oct. The handler fans out to
  // every engagement with paid invoices in that window.
  { id: "softex-quarterly", pattern: "0 5 1 1,4,7,10 *" },

  // Sales follow-ups due today / overdue -> nudge the assigned rep. Twice a day
  // so a morning-scheduled follow-up for the afternoon still gets a reminder.
  { id: "sales-followup", pattern: "0 8,13 * * 1-6" },
];

/** Ids expected by registerSchedules — imported by the wiring test. */
export const SCHEDULE_IDS: readonly string[] = SCHEDULES.map((s) => s.id);

export async function registerSchedules(): Promise<void> {
  const queue = queues.cron;
  for (const s of SCHEDULES) {
    await queue.upsertJobScheduler(
      s.id,
      { pattern: s.pattern, tz: TZ },
      { name: s.id, data: s.data ?? {} },
    );
  }
  console.log(
    `[scheduler] ${SCHEDULES.length} periodic jobs on 'cron' queue (tz=${TZ}): ` +
      SCHEDULES.map((s) => s.id).join(", "),
  );
}

/**
 * Queue names that each held their own repeatable scheduler before the cron
 * consolidation. Their scheduler records would otherwise keep enqueuing jobs
 * into queues that no longer have a worker.
 */
const RETIRED_QUEUES = [
  "sla-cron",
  "reconciliation",
  "dunning",
  "renewal-scanner",
  "timesheet-compiler",
  "harvest-reminder",
  "archive-retention",
  "softex",
  "sales-followup",
] as const;

/**
 * Removes schedules that are no longer in SCHEDULES — otherwise a renamed or
 * deleted entry keeps firing from its Redis record with nothing to catch it —
 * and, once per Redis, clears the schedulers left on the pre-consolidation
 * per-job queues.
 */
export async function pruneStaleSchedulers(): Promise<void> {
  const wanted = new Set(SCHEDULES.map((s) => s.id));
  const cron = queues.cron;

  const existing = await cron.getJobSchedulers(0, 100, true).catch(() => []);
  for (const sched of existing) {
    if (sched?.key && !wanted.has(sched.key)) {
      await cron.removeJobScheduler(sched.key).catch(() => {});
      console.log(`[scheduler] removed stale schedule ${sched.key}`);
    }
  }

  await cleanupRetiredQueues();
}

async function cleanupRetiredQueues(): Promise<void> {
  const MARKER = "cron:retired-queue-cleanup:v1";
  if (await redis.get(MARKER).catch(() => "1")) return; // done, or Redis down — skip

  // Delete the dead queues' keyspaces outright (SCAN, not KEYS — Upstash-safe).
  // Nothing reads or writes bull:<retired>:* any more, so there is nothing to
  // preserve; this stops their orphaned repeatable schedulers from enqueuing.
  let removed = 0;
  for (const name of RETIRED_QUEUES) {
    let cursor = "0";
    do {
      const res: [string, string[]] = await redis
        .scan(cursor, "MATCH", `bull:${name}:*`, "COUNT", 200)
        .catch(() => ["0", []] as [string, string[]]);
      cursor = res[0];
      if (res[1].length) {
        await redis.unlink(...res[1]).catch(() => {});
        removed += res[1].length;
      }
    } while (cursor !== "0");
  }
  if (removed) console.log(`[scheduler] cleared ${removed} keys from ${RETIRED_QUEUES.length} retired queues`);

  await redis.set(MARKER, new Date().toISOString()).catch(() => {});
}
