import { createWorker, QUEUE } from "../../lib/queue";
import { dispatchCron, registeredCronIds } from "./registry";
import { log } from "../../lib/logger";

let started = false;

/**
 * Start the single Worker that drains the consolidated `cron` queue. Idempotent
 * — safe to call from both the inline path (server.ts) and the standalone
 * worker entrypoint. Must be called AFTER every ./cron handler module has been
 * imported, so the registry is fully populated.
 */
export function startCronWorker(): void {
  if (started) return;
  started = true;
  createWorker(QUEUE.cron, dispatchCron);
  log().info(
    { schedules: registeredCronIds() },
    "cron dispatcher draining schedules",
  );
}
