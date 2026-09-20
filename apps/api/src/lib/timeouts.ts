/**
 * Per-integration request budgets for outbound HTTP.
 *
 * Node's `fetch` has no overall timeout. Only the webhook dispatcher set one,
 * so every other third-party call could hang indefinitely — and several of them
 * sit on synchronous user paths: the Google token exchange during sign-in,
 * Resend during registration, MSG91 during OTP, Meilisearch during catalogue
 * search. Because the workers share this process, one unresponsive vendor could
 * exhaust the connection pool and take the whole API down with it.
 *
 * Meilisearch is the sharpest case: MEILI_URL defaults to
 * http://localhost:7700, which is nothing in production, so search has been
 * relying on a connection refusal returning promptly.
 *
 * Numbers are deliberate rather than uniform — a user waiting on sign-in should
 * not wait as long as a background LLM call.
 */
export const TIMEOUT = {
  /** Local-ish search; a miss falls back to Postgres, so fail fast. */
  search: 2_000,
  /** On the sign-in path — the user is watching a spinner. */
  oauth: 5_000,
  /** Transactional email and SMS, also user-facing. */
  messaging: 5_000,
  /** Outbound webhooks to subscriber endpoints. */
  webhook: 10_000,
  /** LLM generation; slow by nature, still bounded. */
  llm: 15_000,
} as const;
