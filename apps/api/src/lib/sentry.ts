import * as Sentry from "@sentry/node";
import { currentReqId } from "./logger";

/**
 * Error reporting for the API and the workers.
 *
 * Inert without `SENTRY_DSN`. That is not a convenience for local development
 * so much as a requirement: CI, the test suites and every contributor's
 * machine run without a DSN, and an error reporter that needs configuration to
 * stay out of the way is one people disable.
 *
 * Deliberately narrow. No performance tracing, no profiling, no session
 * replay: they cost money per event and produce volume nobody reads. This
 * reports errors, which is the thing that was missing.
 *
 * `beforeSend` is the last line of defence for secrets. Logs are already
 * redacted in lib/logger.ts, but an exception carries its own payload —
 * request headers, a query string, the arguments of the frame that threw —
 * and Sentry is a third party.
 */

let enabled = false;

const SCRUB_KEYS = /^(authorization|cookie|x-api-key|password|token|.*secret.*|.*_key)$/i;

export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    // Railway exposes the deploy's commit, which is what makes a Sentry issue
    // say which release introduced it.
    release: process.env.RAILWAY_GIT_COMMIT_SHA,
    tracesSampleRate: 0,
    beforeSend(event) {
      if (event.request?.headers) {
        for (const key of Object.keys(event.request.headers)) {
          if (SCRUB_KEYS.test(key)) event.request.headers[key] = "[redacted]";
        }
      }
      // A query string is the classic place a token ends up by accident.
      if (event.request?.query_string) event.request.query_string = "[redacted]";
      return event;
    },
  });

  enabled = true;
}

export function sentryEnabled(): boolean {
  return enabled;
}

/**
 * Reports an error, tagged with the correlation id so a Sentry issue and a log
 * line can be lined up. Never throws: a failure to report an error must not
 * become a second error.
 */
export function captureException(err: unknown, context: Record<string, unknown> = {}): void {
  if (!enabled) return;
  try {
    const reqId = currentReqId();
    Sentry.withScope((scope) => {
      if (reqId) scope.setTag("reqId", reqId);
      for (const [key, value] of Object.entries(context)) scope.setTag(key, String(value));
      Sentry.captureException(err);
    });
  } catch {
    // Intentionally swallowed, and the only place in this codebase where that
    // is right: the reporter failing must not take down the request whose
    // error it was reporting.
  }
}

/** Flushes buffered events before the process exits. */
export async function flushSentry(timeoutMs = 2000): Promise<void> {
  if (!enabled) return;
  try {
    await Sentry.flush(timeoutMs);
  } catch {
    // Same reasoning as above.
  }
}
