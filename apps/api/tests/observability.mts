/**
 * Correlation id and error-response shape.
 *
 * Runs against an in-process Fastify via `inject()` — no port, no database, no
 * Redis — so it is part of the fast tier and has no excuse not to run.
 *
 *   pnpm --filter @stackfox/api test:observability
 */
import "../src/env";
import Fastify from "fastify";
import { Prisma } from "@stackfox/prisma";
import { registerErrorHandler } from "../src/lib/errorHandler";
import { currentReqId, newReqId, normaliseReqId, runWithReqId } from "../src/lib/logger";
import { REQ_ID_FIELD } from "../src/lib/queue";
import { shouldAlert } from "../src/workers/healthAlert";
import { createRequire } from "module";
import { existsSync } from "fs";
import { resolve, dirname as pathDirname } from "path";
import { fileURLToPath as toPath } from "url";

/**
 * stampReqId and runWithReqId are loaded from dist/ for the job-payload check
 * below, and they have to come from there *together*.
 *
 * stampReqId reads the AsyncLocalStorage owned by lib/logger. The propagation
 * it performs is only observable if the logger instance holding the store is
 * the same one runWithReqId set it on. Across this file's boundary that is not
 * guaranteed: this suite is `.mts` (ESM) while apps/api/src compiles as
 * CommonJS, so lib/logger can be instantiated twice — once for the ESM import
 * here, once for the CommonJS require inside lib/queue — each with its own
 * AsyncLocalStorage and therefore no shared context.
 *
 * Whether that happens depends on the Node version. It does not on Node 22; it
 * does on Node 20, where this check failed with no id stamped. Node 20 is the
 * one that counts — Dockerfile.server is node:20-slim and CI pins 20 to match
 * production — so the local Node 22 pass was false confidence.
 *
 * Requiring both from dist/ puts them in one CommonJS graph with one store,
 * which is also exactly how the container runs them.
 */
const requireCjs = createRequire(import.meta.url);
const distDir = resolve(pathDirname(toPath(import.meta.url)), "../dist");
const distReady = existsSync(resolve(distDir, "lib/queue.js"));
const distQueue = distReady
  ? (requireCjs(resolve(distDir, "lib/queue.js")) as {
      REQ_ID_FIELD: string;
      stampReqId: (data: unknown) => unknown;
    })
  : null;
const distLogger = distReady
  ? (requireCjs(resolve(distDir, "lib/logger.js")) as {
      runWithReqId: <T>(id: string, ctx: object, fn: () => T) => T;
    })
  : null;

const checks: Array<[string, boolean, string]> = [];
const check = (label: string, pass: boolean, note = "") =>
  checks.push([label, pass, note]);

// ── Inbound id handling ──────────────────────────────────────────────────────
//
// The value lands in a log aggregator and in a response header, so an
// unbounded caller-controlled string would be a log-injection and
// header-splitting vector. Accept only something that looks like an id.
{
  check(
    "a well-formed inbound id is accepted",
    normaliseReqId("abc-123_ID.9") === "abc-123_ID.9",
  );
  check(
    "surrounding whitespace is trimmed",
    normaliseReqId("  abc-12345  ") === "abc-12345",
  );
  check("a too-short id is rejected", normaliseReqId("short") === null);
  check("a 129-character id is rejected", normaliseReqId("a".repeat(129)) === null);
  check(
    "a newline is rejected (log injection)",
    normaliseReqId("abcdefgh\nFAKE LOG LINE") === null,
    "a newline in a log line forges a second entry",
  );
  check(
    "a carriage return is rejected (header splitting)",
    normaliseReqId("abcdefgh\r\nSet-Cookie: x=1") === null,
    "the id is echoed in a response header",
  );
  check("a non-string is rejected", normaliseReqId(["abcdefgh"]) === null);
  check("undefined is rejected", normaliseReqId(undefined) === null);

  const ids = new Set(Array.from({ length: 1000 }, () => newReqId()));
  check("1000 generated ids are unique", ids.size === 1000);
  check("a generated id survives its own validator", normaliseReqId(newReqId()) !== null);
}

// ── The context follows the async stack ──────────────────────────────────────
{
  check("no id outside any request", currentReqId() === null);

  const seen = await runWithReqId("req-outer-1234", {}, async () => {
    // An await boundary is where a naive implementation loses the context, and
    // it is exactly where a queue call happens.
    await new Promise((r) => setTimeout(r, 1));
    return currentReqId();
  });
  check("the id survives an await boundary", seen === "req-outer-1234", `got ${seen}`);

  check("the context is cleared afterwards", currentReqId() === null);

  // Two overlapping requests must not see each other's id.
  const [a, b] = await Promise.all([
    runWithReqId("req-aaaa-1111", {}, async () => {
      await new Promise((r) => setTimeout(r, 5));
      return currentReqId();
    }),
    runWithReqId("req-bbbb-2222", {}, async () => {
      await new Promise((r) => setTimeout(r, 1));
      return currentReqId();
    }),
  ]);
  check(
    "concurrent requests keep separate ids",
    a === "req-aaaa-1111" && b === "req-bbbb-2222",
    `got ${a} / ${b} — a shared id would attribute one user's work to another`,
  );
}

// ── The id reaches a job payload ─────────────────────────────────────────────
//
// Both halves come from dist/ so they share one AsyncLocalStorage — see the
// note beside the requires at the top of this file.
if (!distQueue || !distLogger) {
  check(
    "dist/ is built so the job-payload propagation can be checked",
    false,
    "run `pnpm --filter @stackfox/api build` first",
  );
} else {
  const { stampReqId } = distQueue;
  const { runWithReqId: runWithReqIdCjs } = distLogger;

  const stamped = runWithReqIdCjs("req-job-9999", {}, () =>
    stampReqId({ type: "invoice", invoiceId: "INV-1" }),
  ) as Record<string, unknown>;
  check(
    "a job queued inside a request carries its id",
    stamped[distQueue.REQ_ID_FIELD] === "req-job-9999",
    "this is the link between an API log line and a worker log line",
  );
  check("the original payload is preserved", stamped.invoiceId === "INV-1");

  check(
    "a job queued outside a request is untouched",
    (stampReqId({ a: 1 }) as Record<string, unknown>)[distQueue.REQ_ID_FIELD] ===
      undefined,
    "a cron schedule has no request; the worker mints an id instead",
  );
  check(
    "a non-object payload is passed through unchanged",
    stampReqId("plain") === "plain" && stampReqId(null) === null,
  );

  // The field name must agree between the source the API imports and the
  // built copy the worker runs, or a stamped id would be written under one
  // key and read under another.
  check(
    `REQ_ID_FIELD agrees between src and dist ("${REQ_ID_FIELD}")`,
    REQ_ID_FIELD === distQueue.REQ_ID_FIELD,
  );
}

// ── Error responses ──────────────────────────────────────────────────────────
//
// Fastify's default handler puts err.message in the body for 500s. Verified
// against a bare instance: a thrown "connect ECONNREFUSED 10.0.0.5:5432" came
// back to the caller verbatim.
{
  const app = Fastify({ logger: false, genReqId: () => "req-test-abcdefgh" });
  registerErrorHandler(app);

  const SECRET = "connect ECONNREFUSED 10.0.0.5:5432 password=hunter2";
  app.get("/boom", async () => {
    throw new Error(SECRET);
  });
  app.get("/refused", async () => {
    const err = new Error("You may not do that") as Error & { statusCode: number };
    err.statusCode = 403;
    throw err;
  });
  app.get("/dupe", async () => {
    throw new Prisma.PrismaClientKnownRequestError("…", {
      code: "P2002",
      clientVersion: "5",
      meta: { target: ["email"] },
    });
  });
  app.get("/missing", async () => {
    throw new Prisma.PrismaClientKnownRequestError("…", {
      code: "P2025",
      clientVersion: "5",
    });
  });

  const boom = await app.inject({ method: "GET", url: "/boom" });
  check("an unhandled error is a 500", boom.statusCode === 500, `got ${boom.statusCode}`);
  check(
    "the internal message is NOT returned to the caller",
    !boom.body.includes("ECONNREFUSED") && !boom.body.includes("hunter2"),
    `body was ${boom.body}`,
  );
  check(
    "a 500 still returns the request id",
    boom.json().requestId === "req-test-abcdefgh",
    "the id is the only actionable thing a user can quote",
  );

  const refused = await app.inject({ method: "GET", url: "/refused" });
  check("a deliberate 4xx keeps its status", refused.statusCode === 403);
  check(
    "a deliberate 4xx keeps its message",
    refused.json().error === "You may not do that",
    "below 500 the message is one we wrote for the caller",
  );
  check("a 4xx carries the request id", refused.json().requestId === "req-test-abcdefgh");

  const dupe = await app.inject({ method: "GET", url: "/dupe" });
  check(
    "a unique-constraint violation is a 409, not a 500",
    dupe.statusCode === 409,
    `got ${dupe.statusCode}`,
  );
  check(
    "the colliding field is named",
    String(dupe.json().error).includes("email"),
    "otherwise the caller cannot tell which field to change",
  );

  const missing = await app.inject({ method: "GET", url: "/missing" });
  check(
    "a missing record is a 404, not a 500",
    missing.statusCode === 404,
    `got ${missing.statusCode}`,
  );

  const notFound = await app.inject({ method: "GET", url: "/no-such-route" });
  check("an unknown route is a 404 with an id", notFound.statusCode === 404);
  check(
    "the 404 body has the same shape as every other error",
    typeof notFound.json().requestId === "string",
  );

  await app.close();
}

// ── Health alerting fires on change, not on level ────────────────────────────
//
// Alerting every five minutes for as long as something is broken trains
// everyone to ignore it, and an ignored alert is worse than no alert because
// it is believed to be working.
{
  check("the first bad state alerts", shouldAlert(null, "redis"));
  check(
    "the same bad state does not alert again",
    !shouldAlert("redis", "redis"),
    "this is what stops an outage becoming an alert every 5 minutes",
  );
  check(
    "a bad state getting worse alerts again",
    shouldAlert("redis", "database,redis"),
    "losing a second dependency is new information",
  );
  check(
    "recovery alerts",
    shouldAlert("redis", "healthy"),
    "without it nobody knows whether the thing they were paged about is fixed",
  );
  check("staying healthy is silent", !shouldAlert("healthy", "healthy"));
}

// ── Report ───────────────────────────────────────────────────────────────────
console.log("\n--- OBSERVABILITY ---");
let failed = 0;
for (const [label, pass, note] of checks) {
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}${note && !pass ? `  (${note})` : ""}`);
  if (!pass) failed++;
}
console.log(`\n${checks.length - failed}/${checks.length} passed`);
console.log(failed === 0 ? "ALL OBSERVABILITY CHECKS PASSED" : `${failed} FAILED`);

process.exit(failed === 0 ? 0 : 1);
