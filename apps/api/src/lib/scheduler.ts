import { queues, QUEUE } from "./queue";

/**
 * Periodic-job registration.
 *
 * Eleven of the eighteen workers are cron-shaped — they scan the database and
 * act, taking no per-job input (SLA breaches, dunning, reconciliation, renewal
 * scanning, retention, timesheet compilation…). Nothing ever enqueued work into
 * their queues, so they sat idle forever: subscribed, never triggered.
 *
 * BullMQ job schedulers fix that. `upsertJobScheduler` is declarative and
 * idempotent — re-running it on every boot reconciles the schedule rather than
 * stacking duplicates — and the repeat metadata lives in Redis, so exactly one
 * worker in a horizontally-scaled fleet runs each occurrence.
 *
 * Cron expressions are 5-field (min hour dom mon dow) and evaluated in the
 * timezone below. IST matches where the business and its filings sit.
 */
const TZ = process.env.SCHEDULER_TZ ?? "Asia/Kolkata";

interface Schedule {
  queue: keyof typeof QUEUE;
  /** Stable id — reused across boots so the schedule is updated, not duplicated. */
  id: string;
  pattern: string;
  /** Job name + payload handed to the worker for each occurrence. */
  job: { name: string; data?: Record<string, unknown> };
}

const SCHEDULES: Schedule[] = [
  // SLA response-target breaches — needs to be tight or the first-response
  // clock is meaningless.
  { queue: "slaCron", id: "sla-sweep", pattern: "*/15 * * * *", job: { name: "sweep" } },

  // Invoice lifecycle: SENT past due date -> OVERDUE, then dunning notices.
  // Order matters, so reconciliation runs an hour ahead of dunning.
  { queue: "reconciliation", id: "invoice-reconcile", pattern: "0 2 * * *", job: { name: "reconcile" } },
  { queue: "dunning", id: "dunning-run", pattern: "0 3 * * *", job: { name: "run" } },

  // Engagements expiring within 30 days -> RENEWAL_DUE.
  { queue: "renewalScanner", id: "renewal-scan", pattern: "0 4 * * *", job: { name: "scan" } },

  // Draft timesheets left sitting -> reminder to the delivery team.
  { queue: "harvestReminder", id: "harvest-reminder", pattern: "0 9 * * 1-5", job: { name: "remind" } },

  // Fresh weekly timesheet shells for every active T&M / retainer / dedicated
  // engagement, first thing Monday.
  { queue: "timesheetCompiler", id: "timesheet-weekly", pattern: "30 0 * * 1", job: { name: "compile" } },

  // Storage retention sweep for files past FILE_RETENTION_DAYS.
  { queue: "archiveRetention", id: "archive-retention", pattern: "0 1 * * *", job: { name: "sweep" } },

  // SOFTEX (RBI software-export filing) for the quarter that just closed —
  // 05:00 on the first day of Jan / Apr / Jul / Oct. The worker fans out to
  // every engagement with paid invoices in that window.
  { queue: "softex", id: "softex-quarterly", pattern: "0 5 1 1,4,7,10 *", job: { name: "quarter-close" } },

  // Sales follow-ups due today / overdue -> nudge the assigned rep. Twice a day
  // so a morning-scheduled follow-up for the afternoon still gets a reminder.
  { queue: "salesFollowup", id: "sales-followup", pattern: "0 8,13 * * 1-6", job: { name: "sweep" } },
];

export async function registerSchedules(): Promise<void> {
  for (const s of SCHEDULES) {
    const queue = queues[s.queue];
    await queue.upsertJobScheduler(
      s.id,
      { pattern: s.pattern, tz: TZ },
      { name: s.job.name, data: s.job.data ?? {} },
    );
  }
  console.log(
    `[scheduler] ${SCHEDULES.length} periodic jobs registered (tz=${TZ}): ` +
      SCHEDULES.map((s) => s.id).join(", "),
  );
}

/**
 * Removes schedules that are no longer in SCHEDULES — otherwise a renamed or
 * deleted entry keeps firing from its Redis record with nothing to catch it.
 */
export async function pruneStaleSchedulers(): Promise<void> {
  const wanted = new Set(SCHEDULES.map((s) => s.id));
  for (const key of Object.keys(QUEUE) as (keyof typeof QUEUE)[]) {
    const queue = queues[key];
    const existing = await queue.getJobSchedulers(0, 100, true).catch(() => []);
    for (const sched of existing) {
      if (sched?.key && !wanted.has(sched.key)) {
        await queue.removeJobScheduler(sched.key).catch(() => {});
        console.log(`[scheduler] removed stale schedule ${sched.key}`);
      }
    }
  }
}
