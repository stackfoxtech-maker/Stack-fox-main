import { Queue, Worker, type Job, type WorkerOptions } from "bullmq";
import { redis } from "./redis";

// BullMQ needs the full connection (password/tls included — Upstash requires both)
// and maxRetriesPerRequest:null, or Queue/Worker connections hang instead of erroring.
const connection = {
  host: redis.options.host,
  port: redis.options.port,
  username: redis.options.username,
  password: redis.options.password,
  tls: redis.options.tls,
  maxRetriesPerRequest: null as null,
  connectTimeout: 5000,
};

/**
 * Single source of truth for queue names.
 *
 * These were previously written out twice — kebab-case in `createQueue()` and
 * camelCase in each `createWorker()` — so twelve of the eighteen workers were
 * listening on a queue nothing ever published to, and their jobs (invoice PDFs,
 * dunning, SLA breaches, rev-rec, webhooks) silently vanished. Deriving both
 * sides from this map makes that class of bug unrepresentable.
 */
export const QUEUE = {
  docGen: "doc-gen",
  notifications: "notifications",
  webhookDispatcher: "webhook-dispatcher",
  activityTranslator: "activity-translator",
  reconciliation: "reconciliation",
  dunning: "dunning",
  slaCron: "sla-cron",
  timesheetCompiler: "timesheet-compiler",
  revRec: "rev-rec",
  wipLedger: "wip-ledger",
  renewalScanner: "renewal-scanner",
  softex: "softex",
  sandboxRebuild: "sandbox-rebuild",
  harvestReminder: "harvest-reminder",
  archiveRetention: "archive-retention",
  previewGen: "preview-gen",
  referralProcessor: "referral-processor",
  whatsappCommerce: "whatsapp-commerce",
} as const;

export type QueueName = (typeof QUEUE)[keyof typeof QUEUE];

export function createQueue(name: QueueName) {
  return new Queue(name, { connection });
}

export function createWorker<T = any>(
  name: QueueName,
  processor: (job: Job<T>) => Promise<void>,
  opts?: Partial<WorkerOptions>,
) {
  const worker = new Worker<T>(name, processor, {
    connection,
    concurrency: opts?.concurrency ?? 5,
    ...opts,
  });

  worker.on("failed", (job, err) => {
    console.error(`[${name}] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}

export const queues = Object.fromEntries(
  Object.entries(QUEUE).map(([key, name]) => [key, createQueue(name)]),
) as Record<keyof typeof QUEUE, Queue>;
