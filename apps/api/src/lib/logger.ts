import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import pino, { type Logger } from "pino";

/**
 * One logger, and one request id that follows the work.
 *
 * Two problems this solves together.
 *
 * Fastify assigns a per-process incrementing request id ("req-1", "req-2"),
 * which restarts at 1 on every deploy and means nothing across replicas. It
 * also stops at the edge of the request: nothing carried it into a queued job,
 * so a failed invoice PDF could not be tied back to the request that asked for
 * it. When a customer says the invoice never arrived, there was no thread to
 * pull.
 *
 * Separately, the API logged structured JSON via Fastify while the workers
 * used bare `console.*`. Two different shapes in one log stream cannot be
 * queried together, so the half of the system that does the actual work was
 * the half you could not search.
 *
 * The id is carried in AsyncLocalStorage rather than threaded through function
 * signatures. Twelve call sites enqueue jobs and every outbound HTTP call
 * would need the same parameter; a context that follows the async stack means
 * none of them change, and — more to the point — a call site added next year
 * gets the id without anyone remembering to pass it.
 */

export const rootLogger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "test" ? "warn" : "info"),
  // Matches the Fastify logger's configuration so API and worker lines land in
  // the same shape and can be queried together.
  transport:
    process.env.NODE_ENV === "development" ? { target: "pino-pretty" } : undefined,
  redact: {
    // These appear in request logs and in job payloads. A log aggregator is a
    // second place a token can leak from, and it is the place nobody audits.
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.headers['x-api-key']",
      "password",
      "token",
      "refreshToken",
      "accessToken",
      "*.password",
      "*.token",
    ],
    censor: "[redacted]",
  },
});

type Context = { reqId: string; logger: Logger };

const storage = new AsyncLocalStorage<Context>();

/** A fresh correlation id. */
export function newReqId(): string {
  return randomUUID();
}

/**
 * Accept a caller-supplied `x-request-id` so a trace spans the client, the API
 * and anything upstream — but only if it looks like an id. The value reaches a
 * log aggregator and a response header, so an unbounded attacker-controlled
 * string would be a log-injection and header-splitting vector.
 */
export function normaliseReqId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^[A-Za-z0-9._-]{8,128}$/.test(trimmed)) return null;
  return trimmed;
}

/** Runs `fn` with `reqId` bound to every log line and job it produces. */
export function runWithReqId<T>(
  reqId: string,
  bindings: Record<string, unknown>,
  fn: () => T,
): T {
  return storage.run({ reqId, logger: rootLogger.child({ reqId, ...bindings }) }, fn);
}

/** The current request id, or null outside any request or job. */
export function currentReqId(): string | null {
  return storage.getStore()?.reqId ?? null;
}

/**
 * The logger for whatever work is in flight — bound to its request id and job
 * id when there is one, the root logger when there is not. Use this instead of
 * `console.*` anywhere outside a Fastify handler, where `req.log` is better
 * still because it also carries the route.
 */
export function log(): Logger {
  return storage.getStore()?.logger ?? rootLogger;
}
