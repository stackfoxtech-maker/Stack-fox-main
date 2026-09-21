import * as Sentry from '@sentry/react';

/**
 * Client-side error reporting.
 *
 * Inert without `VITE_SENTRY_DSN`, for the same reason as the API side: dev
 * and CI run without one, and a reporter that gets in the way when
 * unconfigured is a reporter people rip out.
 *
 * A browser DSN is public — it ships in the bundle and anyone can read it.
 * That is how Sentry's browser SDK works; the protection is rate limiting and
 * allowed-origin configuration in the Sentry project, not secrecy. Do not put
 * anything else in a VITE_ variable expecting it to stay private.
 *
 * Errors only. No performance tracing and no session replay: replay records
 * what users type, which on a portal showing invoices and contracts is a
 * privacy decision nobody has made.
 */

let enabled = false;

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_COMMIT_SHA,
    tracesSampleRate: 0,
    beforeSend(event) {
      // A reset-password or verify link puts a single-use token in the URL,
      // and the URL is attached to every event.
      if (event.request?.url) {
        try {
          const url = new URL(event.request.url);
          if (url.search) url.search = '';
          event.request.url = url.toString();
        } catch {
          delete event.request.url;
        }
      }
      return event;
    },
  });

  enabled = true;
}

export function sentryEnabled() {
  return enabled;
}

/**
 * Reports an error. Takes the API's `x-request-id` when there is one, so a
 * browser error and the server error behind it land on the same id.
 */
export function captureException(error, context = {}) {
  if (!enabled) return;
  try {
    Sentry.withScope((scope) => {
      for (const [key, value] of Object.entries(context)) {
        if (value != null) scope.setTag(key, String(value));
      }
      Sentry.captureException(error);
    });
  } catch {
    // A failure to report must not become a second error.
  }
}
