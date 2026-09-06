// Env must load before any module reads process.env at import time.
import "../env";

// Direct workers — one Queue + one Worker each, event-driven.
import "./docGen";
import "./notifications";
import "./webhookDispatcher";
import "./activityTranslator";
import "./revRec";
import "./wipLedger";
import "./sandboxRebuild";
import "./previewGen";
import "./referralProcessor";
import "./whatsappCommerce";

// Cron-shaped workers — these now only call registerCron(); a single worker on
// the shared `cron` queue (started below) dispatches to them by job name.
import "./slaCron";
import "./reconciliation";
import "./dunning";
import "./renewalScanner";
import "./harvestReminder";
import "./timesheetCompiler";
import "./archiveRetention";
import "./softex";
import "./salesFollowup";

import { startCronWorker } from "./cron/worker";
import { registerSchedules, pruneStaleSchedulers } from "../lib/scheduler";
import { shutdownQueues } from "../lib/queue";
import { redis } from "../lib/redis";

/**
 * Worker entrypoint.
 *
 * This module previously existed but was never executed — no script referenced
 * it and `server.ts` did not import it — so every queued job (invoice PDFs,
 * dunning, SLA breaches, notifications, rev-rec) sat in Redis unprocessed.
 *
 * Run it either as its own process (`pnpm --filter @stackfox/api worker`, the
 * production shape) or inline with the API by setting `WORKERS_INLINE=true`,
 * which suits single-container deploys.
 *
 * Shutdown: when imported inline by server.ts, ITS SIGTERM/SIGINT handler is
 * the single source of truth and calls shutdownQueues() itself — a second
 * handler here used to race it (both calling process.exit independently) and,
 * critically, neither one closed the Queue + Worker connections this module
 * opens, so every restart (including a plain dev hot-reload) leaked them. Only
 * register the handler below when this file is the process entrypoint
 * (`pnpm worker`), not when some other module imported it.
 */
startCronWorker();
console.log("[workers] 11 workers subscribed (10 direct + 1 cron dispatcher)");

// Register the cron-shaped jobs the periodic handlers depend on. Best-effort:
// a Redis hiccup at boot must not stop the on-demand workers (docgen, notify,
// webhooks) from coming up.
void (async () => {
  try {
    await pruneStaleSchedulers();
    await registerSchedules();
  } catch (err) {
    console.error("[workers] schedule registration failed:", (err as Error).message);
  }
})();

if (require.main === module) {
  const shutdown = async (signal: string) => {
    console.log(`[workers] ${signal} received, draining…`);
    await shutdownQueues().catch(() => {});
    await redis.quit().catch(() => {});
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}
