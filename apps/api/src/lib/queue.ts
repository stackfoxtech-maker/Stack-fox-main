import { Queue, Worker, type Job, type WorkerOptions } from "bullmq";
import { redis } from "./redis";
import { currentReqId, log, newReqId, runWithReqId } from "./logger";
import { captureException } from "./sentry";

// BullMQ needs the full connection (password/tls included — Upstash requires both)
// and maxRetriesPerRequest:null, or Queue/Worker connections hang instead of erroring.
export const connection = {
  host: redis.options.host,
  port: redis.options.port,
  username: redis.options.username,
  password: redis.options.password,
  tls: redis.options.tls,
  maxRetriesPerRequest: null,
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
 *
 * The nine cron-shaped jobs (SLA sweep, reconciliation, dunning, renewal scan,
 * harvest reminder, timesheet compile, archive retention, SOFTEX, sales
 * follow-up) used to have one queue + one worker EACH. Because a job scheduler
 * keeps a delayed "next run" job pending at all times, BullMQ forced every one
 * of those nine workers to a 10s blocking poll no matter the `drainDelay`
 * (~108 Redis cmds/min combined — the dominant idle cost on Upstash). They now
 * share a single `cron` queue drained by one worker; see workers/cron/.
 */
export const QUEUE = {
  docGen: "doc-gen",
  notifications: "notifications",
  webhookDispatcher: "webhook-dispatcher",
  activityTranslator: "activity-translator",
  revRec: "rev-rec",
  wipLedger: "wip-ledger",
  sandboxRebuild: "sandbox-rebuild",
  previewGen: "preview-gen",
  referralProcessor: "referral-processor",
  whatsappCommerce: "whatsapp-commerce",
  cron: "cron",
} as const;

export type QueueName = (typeof QUEUE)[keyof typeof QUEUE];

// Every Queue/Worker opens its OWN ioredis connection, separate from the
// shared `redis` singleton — closing that singleton on shutdown does nothing
// for these. Tracked here so shutdownQueues() (called from server.ts and
// workers/index.ts) can close every one of them. Without this, each dev
// hot-reload (or production redeploy) that doesn't wait for a clean exit
// leaves the previous process's 19 queues + 19 workers connected and still
// polling Redis in the background — the actual cause of a fresh Upstash
// instance being exhausted within minutes of a single long dev session.
const openQueues: Queue[] = [];
const openWorkers: Worker[] = [];

/**
 * The key a correlation id travels under inside a job payload. Underscored so
 * it cannot collide with a real field, and stripped from nothing — workers
 * read it, processors ignore it.
 */
export const REQ_ID_FIELD = "__reqId";

/**
 * Adds the in-flight request id to a job payload. A non-object payload (or no
 * active request, as when a cron schedule fires) is returned untouched —
 * the worker mints a fresh id in that case rather than failing.
 */
export function stampReqId(data: unknown): unknown {
  const reqId = currentReqId();
  if (!reqId || !data || typeof data !== "object" || Array.isArray(data)) return data;
  return { ...(data as Record<string, unknown>), [REQ_ID_FIELD]: reqId };
}

export function createQueue(name: QueueName) {
  const queue = new Queue(name, { connection });

  // Stamp the enqueuing request's id onto every job, by overriding `add` here
  // rather than at each call site. There are twelve call sites today; the
  // point of doing it in one place is the thirteenth, which would otherwise
  // silently drop the id and break the trace exactly when someone needs it.
  const originalAdd = queue.add.bind(queue);
  queue.add = ((jobName: string, data: unknown, opts?: unknown) =>
    originalAdd(jobName, stampReqId(data), opts as never)) as typeof queue.add;

  openQueues.push(queue);
  return queue;
}

/**
 * Queues whose result a caller may be actively waiting on inside the same
 * request/session — a PDF download spinner, a sandbox-preview screen. These
 * keep a short blocking poll so pickup stays snappy. Everything else is
 * fire-and-forget background work where a minute of latency is invisible.
 */
const INTERACTIVE_QUEUES: ReadonlySet<string> = new Set<QueueName>([
  QUEUE.docGen,
  QUEUE.previewGen,
]);

export function createWorker<T = any>(
  name: QueueName,
  processor: (job: Job<T>) => Promise<void>,
  opts?: Partial<WorkerOptions>,
) {
  // Every job runs inside the correlation context of the request that queued
  // it, with a logger already bound to the queue, job and request ids. This is
  // what makes "the invoice never arrived" followable: one id spans the API
  // log line, the job payload and the worker log line.
  const traced = (job: Job<T>) => {
    const carried = (job.data as Record<string, unknown> | null)?.[REQ_ID_FIELD];
    const reqId = typeof carried === "string" ? carried : newReqId();
    return runWithReqId(reqId, { queue: name, jobId: job.id, jobName: job.name }, () =>
      processor(job),
    );
  };

  const worker = new Worker<T>(name, traced, {
    connection,
    concurrency: opts?.concurrency ?? 5,
    // BullMQ's default stalled-job check runs every 30s per worker. With 19
    // workers always connected, that's ~38 Redis round-trips/minute around the
    // clock regardless of actual job traffic. Nearly every queue here is
    // cron-scheduled (see lib/scheduler.ts) at 15-minute-or-longer intervals,
    // so a stalled job sitting undetected for a few extra minutes is a
    // non-issue — trade detection latency for a ~10x cut in idle Redis load.
    stalledInterval: 5 * 60 * 1000,
    // Idle blocking-poll interval. BullMQ's default is 5s: each idle worker
    // fires a BZPOPMIN + moveToActive pair every `drainDelay` seconds forever
    // (~24 Redis cmds/min at the default), which on a metered Redis (Upstash)
    // is the dominant cost when no jobs are flowing. Background queues tolerate
    // a full minute of pickup latency; interactive ones (a PDF/preview the user
    // is waiting on behind a spinner) get 15s — still ~4x cheaper than default.
    drainDelay: INTERACTIVE_QUEUES.has(name) ? 15 : 60,
    ...opts,
  });

  worker.on("failed", (job, err) => {
    const carried = (job?.data as Record<string, unknown> | null)?.[REQ_ID_FIELD];
    // The listener fires outside the job's async context, so bind the id from
    // the payload rather than reading the store.
    log()
      .child({
        queue: name,
        jobId: job?.id,
        jobName: job?.name,
        ...(typeof carried === "string" ? { reqId: carried } : {}),
      })
      .error({ err }, "job failed");

    // Only once the job has exhausted its retries — a transient failure that
    // BullMQ successfully retries is not an incident.
    if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
      captureException(err, {
        queue: name,
        jobId: job.id,
        jobName: job.name,
        ...(typeof carried === "string" ? { reqId: carried } : {}),
      });
    }
  });

  openWorkers.push(worker);
  return worker;
}

export const queues = Object.fromEntries(
  Object.entries(QUEUE).map(([key, name]) => [key, createQueue(name)]),
) as Record<keyof typeof QUEUE, Queue>;

/** Closes every Queue/Worker connection this process has opened. Idempotent. */
export async function shutdownQueues(): Promise<void> {
  const workers = openWorkers.splice(0, openWorkers.length);
  const qs = openQueues.splice(0, openQueues.length);
  await Promise.allSettled([
    ...workers.map((w) => w.close()),
    ...qs.map((q) => q.close()),
  ]);
}
