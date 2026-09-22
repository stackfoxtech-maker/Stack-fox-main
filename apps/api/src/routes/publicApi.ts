import type { FastifyInstance, FastifyRequest } from "fastify";
import { prisma } from "@stackfox/prisma";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { requireApiKey, requireApiScope } from "../plugins/auth";
import { parseBody, parseQuery } from "../lib/validate";
import { assertPublicHttpUrl } from "../lib/safeUrl";
import { LIST_CAP, pageParams } from "../lib/http";

/**
 * The public API, `/v1`.
 *
 * These routes were unregistered in Phase 0. Their only guard was a
 * `requireApiKey` that checked the header was non-empty and returned true, and
 * on top of that every list read its `orgId` **from the query string** — so a
 * caller both authenticated with any string and chose whose data to read.
 * Thirteen endpoints served every org's engagements, invoices, projects,
 * tickets and events, and `POST /v1/webhooks` accepted an arbitrary URL for an
 * arbitrary org.
 *
 * The rule that makes this safe is one line: **the org comes from the key,
 * never from the request.** `req.apiKey.orgId` is the only source of tenancy
 * below, and there is no parameter that can override it.
 *
 * A row belonging to another tenant answers 404, not 403. 403 confirms the id
 * exists, which turns a guess into an enumeration oracle.
 */

/**
 * The catalogue is public product data — the same for every tenant.
 *
 * The old handler filtered on `active`, `tier` and `categoryL1`. None of those
 * are fields on ServiceUnit: the model has `status` (DRAFT|PUBLISHED|ARCHIVED)
 * and `categoryTier1`/`categoryTier2`. Prisma rejects an unknown field at
 * runtime, so `GET /v1/services` threw on every call — hidden because the
 * `where` was typed `any`. Corrected here against the actual model.
 */
const ListServicesQuery = z.object({
  category: z.string().trim().max(100).optional(),
  subcategory: z.string().trim().max(100).optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});

const ListEngagementsQuery = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
});

const ListProjectsQuery = z.object({
  engId: z.string().trim().max(64).optional(),
  status: z.string().trim().max(50).optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});

const ListInvoicesQuery = z.object({
  engId: z.string().trim().max(64).optional(),
  status: z.string().trim().max(50).optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});

const ListTicketsQuery = z.object({
  projectId: z.string().trim().max(64).optional(),
  status: z.string().trim().max(50).optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});

const ListEventsQuery = z.object({
  engId: z.string().trim().max(64).optional(),
  since: z.string().datetime({ offset: true }).or(z.string().date()).optional(),
  limit: z.string().optional(),
});

const CreateWebhookSchema = z
  .object({
    // orgId is deliberately absent. It used to be taken from the body, which
    // is how an arbitrary URL was registered against an arbitrary org.
    url: z.string().trim().min(1).max(2048),
    events: z.array(z.string().trim().min(1).max(100)).max(50).optional(),
  })
  .strict();

/** The tenant for this request. Set by requireApiKey; never from user input. */
function orgOf(req: FastifyRequest): string {
  // requireApiKey runs as a preHandler for every route in this plugin and
  // short-circuits with 401 when it fails, so this is always set by the time a
  // handler runs. The throw is a guard against someone adding a route outside
  // that hook, not an expected path.
  if (!req.apiKey) throw new Error("publicApi handler ran without an authenticated key");
  return req.apiKey.orgId;
}

export async function publicApiRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (req, reply) => {
    // /v1/health is the one endpoint a monitor must reach without credentials.
    if (req.url.startsWith("/v1/health")) return;
    if (!(await requireApiKey(req, reply))) return reply;
  });

  // ── Catalogue: public product data, identical for every tenant ────────────
  app.get("/v1/services", async (req, reply) => {
    const q = parseQuery(req, reply, ListServicesQuery);
    if (!q) return;
    const { limit, skip } = pageParams(q);

    return prisma.serviceUnit.findMany({
      // Only published services: DRAFT and ARCHIVED rows are internal.
      where: {
        status: "PUBLISHED",
        ...(q.category && { categoryTier1: q.category }),
        ...(q.subcategory && { categoryTier2: q.subcategory }),
      },
      orderBy: { name: "asc" },
      skip,
      take: limit,
    });
  });

  app.get("/v1/services/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const svc = await prisma.serviceUnit.findUnique({
      where: { id },
      include: { featureUnits: true },
    });
    if (!svc || svc.status !== "PUBLISHED")
      return reply.code(404).send({ error: "Not found" });
    return svc;
  });

  // ── Engagements ───────────────────────────────────────────────────────────
  app.get("/v1/engagements", async (req, reply) => {
    const q = parseQuery(req, reply, ListEngagementsQuery);
    if (!q) return;
    const { limit, skip } = pageParams(q);

    return prisma.engagement.findMany({
      where: { clientId: orgOf(req) },
      include: { projects: { select: { id: true, name: true, status: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    });
  });

  app.get("/v1/engagements/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const eng = await prisma.engagement.findFirst({
      where: { id, clientId: orgOf(req) },
      include: { projects: true, contracts: true },
    });
    if (!eng) return reply.code(404).send({ error: "Not found" });
    return eng;
  });

  // ── Projects ──────────────────────────────────────────────────────────────
  app.get("/v1/projects", async (req, reply) => {
    const q = parseQuery(req, reply, ListProjectsQuery);
    if (!q) return;
    const { limit, skip } = pageParams(q);

    return prisma.project.findMany({
      where: {
        // The join to engagement is what scopes this: a project is reachable
        // only through an engagement belonging to the key's org.
        engagement: { clientId: orgOf(req) },
        ...(q.engId && { engagementId: q.engId }),
        ...(q.status && { status: q.status }),
      },
      include: { milestones: { orderBy: { number: "asc" }, take: LIST_CAP } },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    });
  });

  app.get("/v1/projects/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const project = await prisma.project.findFirst({
      where: { id, engagement: { clientId: orgOf(req) } },
      include: { milestones: { take: LIST_CAP }, changeRequests: { take: LIST_CAP } },
    });
    if (!project) return reply.code(404).send({ error: "Not found" });
    return project;
  });

  // ── Invoices ──────────────────────────────────────────────────────────────
  app.get("/v1/invoices", async (req, reply) => {
    const q = parseQuery(req, reply, ListInvoicesQuery);
    if (!q) return;
    const { limit, skip } = pageParams(q);

    return prisma.invoice.findMany({
      where: {
        engagement: { clientId: orgOf(req) },
        ...(q.engId && { engagementId: q.engId }),
        ...(q.status && { status: q.status }),
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    });
  });

  app.get("/v1/invoices/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const inv = await prisma.invoice.findFirst({
      where: { id, engagement: { clientId: orgOf(req) } },
    });
    if (!inv) return reply.code(404).send({ error: "Not found" });
    return inv;
  });

  // ── Tickets ───────────────────────────────────────────────────────────────
  app.get("/v1/tickets", async (req, reply) => {
    const q = parseQuery(req, reply, ListTicketsQuery);
    if (!q) return;
    const { limit, skip } = pageParams(q);

    return prisma.ticket.findMany({
      where: {
        project: { engagement: { clientId: orgOf(req) } },
        ...(q.projectId && { projectId: q.projectId }),
        ...(q.status && { status: q.status }),
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    });
  });

  app.get("/v1/tickets/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const ticket = await prisma.ticket.findFirst({
      where: { id, project: { engagement: { clientId: orgOf(req) } } },
    });
    if (!ticket) return reply.code(404).send({ error: "Not found" });
    return ticket;
  });

  // ── Events ────────────────────────────────────────────────────────────────
  app.get("/v1/events", async (req, reply) => {
    const q = parseQuery(req, reply, ListEventsQuery);
    if (!q) return;
    const { limit } = pageParams(q, 100);

    // Event carries `engagementId` as a plain column with no relation to
    // Engagement, so there is no join to scope through — resolve the org's
    // engagement ids first and filter on those. An org with no engagements
    // gets an empty list rather than an unfiltered one.
    const owned = await prisma.engagement.findMany({
      where: { clientId: orgOf(req) },
      select: { id: true },
      take: LIST_CAP,
    });
    const engagementIds = owned.map((e) => e.id);
    if (engagementIds.length === 0) return [];

    // A caller-supplied engId must be one of theirs, not merely present.
    if (q.engId && !engagementIds.includes(q.engId)) return [];

    return prisma.event.findMany({
      where: {
        engagementId: q.engId ? q.engId : { in: engagementIds },
        ...(q.since && { createdAt: { gte: new Date(q.since) } }),
      },
      take: limit,
      orderBy: { createdAt: "desc" },
    });
  });

  // ── Webhooks ──────────────────────────────────────────────────────────────
  app.post("/v1/webhooks", async (req, reply) => {
    if (!(await requireApiScope(req, reply, "write"))) return;
    const body = parseBody(req, reply, CreateWebhookSchema);
    if (!body) return;

    // The server will make requests to this URL. Without this check it is an
    // SSRF primitive: a subscriber could point it at 169.254.169.254 and have
    // the API fetch cloud credentials on their behalf.
    const check = await assertPublicHttpUrl(body.url);
    if (!check.ok) return reply.code(400).send({ error: check.reason });

    const endpoint = await prisma.webhookEndpoint.create({
      data: {
        orgId: orgOf(req),
        url: body.url,
        // Each endpoint gets its own signing secret so a leak from one
        // subscriber cannot be used to forge deliveries to another.
        secret: randomBytes(32).toString("hex"),
        events: body.events ?? [],
        active: true,
      },
    });

    // The secret is returned once, on creation, and never listed afterwards.
    return reply.code(201).send(endpoint);
  });

  app.get("/v1/webhooks", async (req) => {
    return prisma.webhookEndpoint.findMany({
      where: { orgId: orgOf(req) },
      // Deliberately omits `secret`: a read-scoped key must not be able to
      // read back the signing secret of an endpoint it can already see.
      select: {
        id: true,
        url: true,
        events: true,
        active: true,
        createdAt: true,
      },
      take: LIST_CAP,
    });
  });

  app.delete("/v1/webhooks/:id", async (req, reply) => {
    if (!(await requireApiScope(req, reply, "write"))) return;
    const { id } = req.params as { id: string };

    // deleteMany with the org in the filter, so another tenant's id deletes
    // nothing rather than deleting theirs.
    const { count } = await prisma.webhookEndpoint.deleteMany({
      where: { id, orgId: orgOf(req) },
    });
    if (count === 0) return reply.code(404).send({ error: "Not found" });
    return { success: true };
  });

  // Unauthenticated by design — a monitor needs to reach it.
  app.get("/v1/health", async () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
  }));
}
