import { registerCron } from "./cron/registry";
import { prisma } from "@stackfox/prisma";
import { redis } from "../lib/redis";
import { isStorageConfigured } from "../lib/storage";
import { log } from "../lib/logger";
import { captureException } from "../lib/sentry";

/**
 * Notices when a dependency goes away, and says so once.
 *
 * `/health` already reported Postgres, Redis and storage, but nothing read it.
 * Railway's health check does — and its only reaction is to restart the
 * container, which does nothing for a Redis that is down and everything for
 * hiding that it was. The failure this is actually for is the quiet one: Redis
 * unreachable, so OTP, password reset, token revocation and every background
 * job stop working while the API keeps answering 200 and nobody is told.
 *
 * ── What this cannot do ──────────────────────────────────────────────────────
 *
 * It runs *inside* the API process, so it cannot report that the API is down.
 * A process that has crashed does not alert on its own crash. Full-outage
 * detection needs something outside the deployment — an uptime monitor hitting
 * /health, or Railway's own alerting. This covers the other case, which is the
 * one nothing else covers: the process is alive and a dependency is not.
 *
 * ── Why state changes and not levels ────────────────────────────────────────
 *
 * Alerting on "currently degraded" every five minutes trains everyone to
 * ignore it, and an ignored alert is worse than none because it is believed to
 * be working. This fires on the transition into a bad state and on the
 * transition back out, and stays quiet in between.
 */

type Health = { database: boolean; redis: boolean; storage: boolean };

/**
 * Survives between runs within a process, which is all that is needed: a
 * restart re-alerts, and a restart is itself worth knowing about.
 */
let lastReported: string | null = null;

function summarise(h: Health): string {
  const down = Object.entries(h)
    .filter(([, ok]) => !ok)
    .map(([name]) => name);
  return down.length ? down.sort().join(",") : "healthy";
}

export async function checkHealth(): Promise<Health> {
  const [database, redisUp] = await Promise.all([
    prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
    redis
      .ping()
      .then(() => true)
      .catch(() => false),
  ]);
  return { database, redis: redisUp, storage: isStorageConfigured() };
}

/**
 * Exported for the test: given the previous and current summaries, should this
 * run say anything?
 */
export function shouldAlert(previous: string | null, current: string): boolean {
  return previous !== current;
}

/** What each failure actually costs, so an alert says why it matters. */
const IMPACT: Record<keyof Health, string> = {
  database: "every request that touches data fails",
  redis: "OTP, password reset, token revocation and all background jobs are degraded",
  storage: "invoice, contract and quote PDFs cannot be stored or served",
};

registerCron("health-alert", async () => {
  const health = await checkHealth();
  const current = summarise(health);

  if (!shouldAlert(lastReported, current)) return;

  const previous = lastReported;
  lastReported = current;

  if (current === "healthy") {
    // The recovery notice matters as much as the alert: without it nobody
    // knows whether the thing they were paged about is still broken.
    log().warn({ previous }, "dependencies recovered");
    return;
  }

  const down = current.split(",") as Array<keyof Health>;
  const impact = down.map((d) => `${d}: ${IMPACT[d]}`);

  log().error({ down, impact, previous }, "dependency unavailable");

  // Sentry is the only channel here that reaches a person who is not already
  // reading logs. Captured as an Error so it groups and alerts like one.
  captureException(new Error(`Dependency unavailable: ${current}`), {
    down: current,
    previous: previous ?? "unknown",
  });
});
