import "./env";

import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";

import { prisma } from "@stackfox/prisma";
import { redis } from "./lib/redis";
import { isStorageConfigured } from "./lib/storage";
import { authPlugin } from "./plugins/auth";

/**
 * Background workers normally run as their own process
 * (`pnpm --filter @stackfox/api worker`). Single-container deploys can instead
 * set WORKERS_INLINE=true to host them alongside the HTTP server.
 */
const WORKERS_INLINE = process.env.WORKERS_INLINE === "true";
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
import { publicApiRoutes } from "./routes/publicApi";
import { adminRoutes } from "./routes/admin";
import { toolRoutes } from "./routes/tools";
import { blogRoutes } from "./routes/blog";
import { cartRoutes } from "./routes/cart";
import { quoteRoutes, backfillPaidQuotes } from "./routes/quotes";
import { analyticsRoutes } from "./routes/analytics";
import { referralRoutes } from "./routes/referrals";
import { settingsRoutes } from "./routes/settings";
import { reviewRoutes } from "./routes/reviews";
import { knowledgeRoutes } from "./routes/knowledge";
import { projectInquiryRoutes } from "./routes/projectInquiries";
import { reportRoutes } from "./routes/reports";
import { handoverRoutes } from "./routes/handover";
import { adminReportRoutes } from "./routes/adminReports";

const app = Fastify({
  logger: {
    transport:
      process.env.NODE_ENV === "development"
        ? { target: "pino-pretty" }
        : undefined,
  },
});

async function start() {
  const corsOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:3000")
    .split(",")
    .map((o) => o.trim());
  await app.register(cors, {
    origin: corsOrigins,
    credentials: true,
  });
  await app.register(helmet);
  await app.register(rateLimit, { max: 100, timeWindow: "1 minute" });

  // The web client sets `Content-Type: application/json` on every request, so a
  // POST with no body (an action route like .../accept or .../reveal) arrives
  // with the JSON content type and an empty payload — which Fastify rejects as
  // a 400 before the handler runs. Treat an empty body as `{}`.
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (_req, body: string, done) => {
      if (!body || body.trim() === "") return done(null, {});
      try {
        done(null, JSON.parse(body));
      } catch (err) {
        (err as Error & { statusCode?: number }).statusCode = 400;
        done(err as Error, undefined);
      }
    },
  );

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
      checks: { database: db, redis: cache, storage: isStorageConfigured() },
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
  await app.register(publicApiRoutes, { prefix: "/" });
  await app.register(adminRoutes, { prefix: "/" });
  await app.register(toolRoutes, { prefix: "/" });
  await app.register(blogRoutes, { prefix: "/" });
  await app.register(cartRoutes, { prefix: "/" });
  await app.register(quoteRoutes, { prefix: "/" });
  await app.register(analyticsRoutes, { prefix: "/" });
  await app.register(referralRoutes, { prefix: "/" });
  await app.register(settingsRoutes, { prefix: "/" });
  await app.register(reviewRoutes, { prefix: "/" });
  await app.register(knowledgeRoutes, { prefix: "/" });
  await app.register(projectInquiryRoutes, { prefix: "/" });
  await app.register(reportRoutes, { prefix: "/" });
  await app.register(handoverRoutes, { prefix: "/" });
  await app.register(adminReportRoutes, { prefix: "/" });

  const port = Number(process.env.PORT) || 4000;
  const host = process.env.HOST ?? "0.0.0.0";

  if (WORKERS_INLINE) {
    await import("./workers/index");
    app.log.info("Background workers running inline (WORKERS_INLINE=true)");
  }

  await app.listen({ port, host });
  app.log.info(`API listening on ${host}:${port}`);

  backfillPaidQuotes().catch((err) => app.log.error(err, "Quote backfill failed"));

  const close = async (signal: string) => {
    app.log.info(`${signal} received, shutting down`);
    await app.close();
    await prisma.$disconnect().catch(() => {});
    await redis.quit().catch(() => {});
    process.exit(0);
  };
  process.on("SIGTERM", () => void close("SIGTERM"));
  process.on("SIGINT", () => void close("SIGINT"));
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
