import type { Job } from "bullmq";

/**
 * Handler registry for the consolidated `cron` queue.
 *
 * Before consolidation each of the nine cron-shaped workers (SLA sweep, invoice
 * reconciliation, dunning, renewal scan, harvest reminder, timesheet compile,
 * archive retention, SOFTEX, sales follow-up) had its own Queue + Worker. Every
 * one of those workers kept a "next run" delayed job pending at all times, and
 * BullMQ forces a worker with pending delayed jobs to a 10s blocking poll
 * regardless of `drainDelay` — nine of them together were ~108 Redis
 * commands/minute of pure idle churn, the bulk of the load that exhausts a
 * metered Redis (Upstash).
 *
 * Now every periodic job is one BullMQ job name on a single `cron` queue,
 * drained by one worker (see ./worker.ts). Each former worker file registers
 * its body here keyed by the schedule id from lib/scheduler.ts.
 *
 * This module deliberately imports nothing but a BullMQ *type* — it stays free
 * of any Redis connection so the wiring can be unit-tested in isolation.
 */
export type CronHandler = (job: Job) => Promise<void>;

const handlers = new Map<string, CronHandler>();

/**
 * Register a periodic handler. `id` MUST match a schedule id in
 * lib/scheduler.ts — that id is the BullMQ job name the scheduler emits and the
 * key this dispatches on. Registering the same id twice is a programming error
 * (two files claiming the same schedule) and throws at import time.
 */
export function registerCron(id: string, handler: CronHandler): void {
  if (handlers.has(id)) {
    throw new Error(`[cron] duplicate handler id "${id}" — two workers claim the same schedule`);
  }
  handlers.set(id, handler);
}

/**
 * Route a job to its handler by name. An unknown name is logged and skipped
 * rather than thrown: a schedule removed from code but still firing from its
 * Redis record must not crash the worker (pruneStaleSchedulers cleans those up
 * on the next boot).
 */
export async function dispatchCron(job: Job): Promise<void> {
  const handler = handlers.get(job.name);
  if (!handler) {
    console.error(`[cron] no handler registered for "${job.name}" — skipped`);
    return;
  }
  await handler(job);
}

/** Registered schedule ids, sorted. For startup logging and tests. */
export function registeredCronIds(): string[] {
  return [...handlers.keys()].sort();
}
