// Env must load before any module reads process.env at import time.
import "../env";

import "./docGen";
import "./notifications";
import "./webhookDispatcher";
import "./activityTranslator";
import "./reconciliation";
import "./dunning";
import "./slaCron";
import "./timesheetCompiler";
import "./revRec";
import "./wipLedger";
import "./renewalScanner";
import "./softex";
import "./sandboxRebuild";
import "./harvestReminder";
import "./archiveRetention";
import "./previewGen";
import "./referralProcessor";
import "./whatsappCommerce";

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
 */
console.log("[workers] 18 workers subscribed");

async function shutdown(signal: string) {
  console.log(`[workers] ${signal} received, draining…`);
  try {
    await redis.quit();
  } catch {
    /* already closed */
  }
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
