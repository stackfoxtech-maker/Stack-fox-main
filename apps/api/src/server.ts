import "./env";

import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";

import { prisma } from "@stackfox/prisma";
import { redis } from "./lib/redis";
import { isStorageConfigured } from "./lib/storage";
import { authPlugin } from "./plugins/auth";
import { log, newReqId, normaliseReqId, runWithReqId } from "./lib/logger";
import { registerErrorHandler } from "./lib/errorHandler";
import { captureException, flushSentry, initSentry, sentryEnabled } from "./lib/sentry";

/**
 * Background workers run inline with the HTTP server by default — the deploy is
 * a single container (Dockerfile.server), so this is the only way they run at
 * all. Set WORKERS_INLINE=false ONLY when a dedicated worker process
 * (`pnpm --filter @stackfox/api worker`) is also running, to avoid processing
 * every job twice.
 */
const WORKERS_INLINE = process.env.WORKERS_INLINE !== "false";
import { authRoutes } from "./routes/auth";
import { catalogueRoutes } from "./routes/catalogue";
import { workspaceRoutes } from "./routes/workspaces";
import { estimateRoutes } from "./routes/estimates";
import { checkoutRoutes } from "./routes/checkout";
import { contractRoutes } from "./routes/contracts";
import { engagementRoutes } from "./routes/engagements";
import { projectRoutes } from "./routes/projects";
import { timesheetRoutes } from "./routes/timesheets";
import { programRoutes } from "./routes/programs";
import { rfpRoutes } from "./routes/rfps";
import { eventRoutes } from "./routes/events";
import { financeRoutes } from "./routes/finance";
import { paymentRoutes } from "./routes/payments";
import { feedbackRoutes } from "./routes/feedback";
import { changeRequestRoutes } from "./routes/changeRequests";
import { userRoutes } from "./routes/users";
import { assistantRoutes } from "./routes/assistant";
import { jobRoutes } from "./routes/jobs";
import { taskRoutes } from "./routes/tasks";
import { messageRoutes } from "./routes/messages";
import { fileRoutes } from "./routes/files";
import { ticketRoutes } from "./routes/tickets";
import { notificationRoutes } from "./routes/notifications";
import { adminRoutes } from "./routes/admin";
import { toolRoutes } from "./routes/tools";
import { blogRoutes } from "./routes/blog";
import { cartRoutes } from "./routes/cart";
import { quoteRoutes } from "./routes/quotes";
import { analyticsRoutes } from "./routes/analytics";
import { referralRoutes } from "./routes/referrals";
import { leadRoutes } from "./routes/leads";
import { settingsRoutes } from "./routes/settings";
import { reviewRoutes } from "./routes/reviews";
import { knowledgeRoutes } from "./routes/knowledge";
import { projectInquiryRoutes } from "./routes/projectInquiries";
import { reportRoutes } from "./routes/reports";
import { handoverRoutes } from "./routes/handover";
import { adminReportRoutes } from "./routes/adminReports";
import { documentRoutes } from "./routes/documents";

const app = Fastify({
  // Railway terminates TLS and forwards, so without this every request is keyed
  // by the proxy's address: the rate limiter below would throttle all users as
  // one, and req.ip would never be the real client.
  trustProxy: true,
  // Fastify's default id is a per-process counter ("req-1"), which restarts
  // at 1 on every deploy and collides across replicas. Accept a caller's
  // x-request-id when it is well-formed so a trace spans client and API,
  // otherwise mint a UUID.
  genReqId: (req) => normaliseReqId(req.headers["x-request-id"]) ?? newReqId(),
  logger: {
    transport:
      process.env.NODE_ENV === "development"
        ? { target: "pino-pretty" }
        : undefined,
    redact: {
      // A log aggregator is a second place a bearer token can leak from, and
      // it is the place nobody audits.
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "req.headers['x-api-key']",
      ],
      censor: "[redacted]",
    },
  },
});

// Before anything else, so an error during start-up is reported too.
initSentry();

async function start() {
  const BUILT_IN_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://stackfox.in",
    "https://www.stackfox.in",
    "https://stackfox-client-stackfox1.vercel.app",
    "https://stackfox-client.vercel.app",
    "https://stackfox-client-git-main-stackfox1.vercel.app",
  ];
  const extraOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
    : [];
  const corsOrigins = [...new Set([...BUILT_IN_ORIGINS, ...extraOrigins])];
  await app.register(cors, {
    origin: corsOrigins,
    credentials: true,
  });
  await app.register(helmet);
  // Backed by Redis, not the default in-process LRU. Counters in memory reset
  // on every deploy and do not aggregate across replicas, so horizontal scaling
  // silently multiplied every limit — including the ones guarding OTP and the
  // unauthenticated assistant endpoint.
  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
    redis,
    // Redis being unreachable must not lock everyone out; fall back to
    // in-process counting rather than rejecting.
    skipOnError: true,
  });

  // The web client sets `Content-Type: application/json` on every request, so a
  // POST with no body (an action route like .../accept or .../reveal) arrives
  // with the JSON content type and an empty payload — which Fastify rejects as
  // a 400 before the handler runs. Treat an empty body as `{}`.
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (req, body: string, done) => {
      // Keep the raw text around for webhook signature verification
      // (Stripe/Razorpay sign the exact bytes, not the re-serialised object).
      (req as { rawBody?: string }).rawBody = body;
      if (!body || body.trim() === "") return done(null, {});
      try {
        done(null, JSON.parse(body));
      } catch (err) {
        (err as Error & { statusCode?: number }).statusCode = 400;
        done(err as Error, undefined);
      }
    },
  );

  // Everything downstream of here — including queued jobs and outbound calls —
  // runs inside a context carrying this request's id. onRequest is the first
  // hook in the lifecycle, so the whole handler chain is covered.
  app.addHook("onRequest", (req, reply, done) => {
    reply.header("x-request-id", req.id);
    runWithReqId(String(req.id), { route: req.routeOptions?.url }, done);
  });

  registerErrorHandler(app);

  // Auth plugin (decorators + hooks)
  await app.register(authPlugin);

  // Health check — reports the dependencies the app actually needs, so a
  // degraded deploy (DB reachable but Redis down, i.e. no background jobs) is
  // visible to a load balancer instead of reporting a flat "ok".
  app.get("/health", async (_req, reply) => {
    const [db, cache] = await Promise.all([
      prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
      redis.ping().then(() => true).catch(() => false),
    ]);

    const status = db && cache ? "ok" : db ? "degraded" : "down";
    if (status === "down") reply.code(503);

    return {
      status,
      ts: Date.now(),
      checks: {
        database: db,
        redis: cache,
        storage: isStorageConfigured(),
        errorReporting: sentryEnabled(),
      },
      workersInline: WORKERS_INLINE,
    };
  });

  // Route modules
  await app.register(authRoutes, { prefix: "/" });
  await app.register(catalogueRoutes, { prefix: "/" });
  await app.register(workspaceRoutes, { prefix: "/" });
  await app.register(estimateRoutes, { prefix: "/" });
  await app.register(checkoutRoutes, { prefix: "/" });
  await app.register(contractRoutes, { prefix: "/" });
  await app.register(engagementRoutes, { prefix: "/" });
  await app.register(projectRoutes, { prefix: "/" });
  await app.register(timesheetRoutes, { prefix: "/" });
  await app.register(programRoutes, { prefix: "/" });
  await app.register(rfpRoutes, { prefix: "/" });
  await app.register(eventRoutes, { prefix: "/" });
  await app.register(financeRoutes, { prefix: "/" });
  await app.register(paymentRoutes, { prefix: "/" });
  await app.register(feedbackRoutes, { prefix: "/" });
  await app.register(changeRequestRoutes, { prefix: "/" });
  await app.register(userRoutes, { prefix: "/" });
  await app.register(assistantRoutes, { prefix: "/" });
  await app.register(jobRoutes, { prefix: "/" });
  await app.register(taskRoutes, { prefix: "/" });
  await app.register(messageRoutes, { prefix: "/" });
  await app.register(fileRoutes, { prefix: "/" });
  await app.register(ticketRoutes, { prefix: "/" });
  await app.register(notificationRoutes, { prefix: "/" });
  // publicApiRoutes (/v1/*) is DELIBERATELY NOT REGISTERED.
  //
  // Its only guard was `requireApiKey`, which checked that the `x-api-key`
  // header was non-empty and returned true — it never validated the value. That
  // left 13 unauthenticated, untenanted endpoints serving every org's
  // engagements, invoices, projects, tickets and events, plus a webhook
  // registration endpoint that accepted an arbitrary URL for an arbitrary org.
  //
  // Re-enable ONLY once requireApiKey resolves the presented key against
  // ApiKey.keyHash (the model already exists, see schema.prisma), rejects
  // revoked keys, and every /v1 query is scoped by the key's orgId.
  // No first-party client calls /v1/*, so nothing depends on this today.
  await app.register(adminRoutes, { prefix: "/" });
  await app.register(toolRoutes, { prefix: "/" });
  await app.register(blogRoutes, { prefix: "/" });
  await app.register(cartRoutes, { prefix: "/" });
  await app.register(quoteRoutes, { prefix: "/" });
  await app.register(analyticsRoutes, { prefix: "/" });
  await app.register(referralRoutes, { prefix: "/" });
  await app.register(leadRoutes, { prefix: "/" });
  await app.register(settingsRoutes, { prefix: "/" });
  await app.register(reviewRoutes, { prefix: "/" });
  await app.register(knowledgeRoutes, { prefix: "/" });
  await app.register(projectInquiryRoutes, { prefix: "/" });
  await app.register(reportRoutes, { prefix: "/" });
  await app.register(handoverRoutes, { prefix: "/" });
  await app.register(adminReportRoutes, { prefix: "/" });
  await app.register(documentRoutes, { prefix: "/" });

  const port = Number(process.env.PORT) || 4000;
  const host = process.env.HOST ?? "0.0.0.0";

  if (WORKERS_INLINE) {
    await import("./workers/index");
    app.log.info("Background workers + job scheduler running inline");
  } else {
    app.log.warn(
      "WORKERS_INLINE=false — this process serves HTTP only. A separate " +
        "`pnpm --filter @stackfox/api worker` process must be running, or ALL " +
        "background work is dead: invoice/contract PDFs, notifications, webhooks, " +
        "dunning, SLA breaches, rev-rec, renewals, retention, sales follow-ups.",
    );
  }

  await app.listen({ port, host });
  app.log.info(`API listening on ${host}:${port}`);

  // backfillPaidQuotes() used to run here on every boot. It is a one-off data
  // migration, and for any org whose engagements happened to have no projects
  // attached it DELETED that org's invoices, contracts and engagements before
  // re-provisioning from a quote — scoped to the whole org, not to the quote.
  // Run it deliberately instead:
  //   pnpm --filter @stackfox/api backfill:quotes -- --dry-run
  // See apps/api/scripts/backfill-paid-quotes.mts.

  const close = async (signal: string) => {
    app.log.info(`${signal} received, shutting down`);
    await app.close();
    if (WORKERS_INLINE) {
      // Each of the 19 BullMQ Queues/Workers holds its own Redis connection,
      // separate from the shared `redis` singleton below — closing only that
      // singleton left all 38 connections open on every restart (including a
      // plain dev hot-reload), still polling Redis in the background.
      const { shutdownQueues } = await import("./lib/queue");
      await shutdownQueues().catch(() => {});
    }
    await prisma.$disconnect().catch(() => {});
    await redis.quit().catch(() => {});
    process.exit(0);
  };
  process.on("SIGTERM", () => void close("SIGTERM"));
  process.on("SIGINT", () => void close("SIGINT"));
}

start().catch(async (err) => {
  log().fatal({ err }, "server failed to start");
  captureException(err, { phase: "startup" });
  // Without this the process exits before the event leaves the buffer, so the
  // failures you most want reported are the ones that never arrive.
  await flushSentry();
  process.exit(1);
});
