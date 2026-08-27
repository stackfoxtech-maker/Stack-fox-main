import type { FastifyInstance } from "fastify";
import { prisma } from "@stackfox/prisma";
import { requireApiKey } from "../plugins/auth";
import { randomBytes } from "crypto";

export async function publicApiRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (req, reply) => {
    if (!requireApiKey(req, reply)) return;
  });

  // /v1/services
  app.get("/v1/services", async (req) => {
    const { tier, category, page = "1", limit = "50" } = req.query as Record<string, string>;
    const where: any = { active: true };
    if (tier) where.tier = tier;
    if (category) where.categoryL1 = category;
    return prisma.serviceUnit.findMany({
      where,
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
    });
  });

  // /v1/services/:id
  app.get("/v1/services/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const svc = await prisma.serviceUnit.findUnique({ where: { id }, include: { featureUnits: true } });
    if (!svc) return reply.code(404).send({ error: "Not found" });
    return svc;
  });

  // /v1/engagements
  app.get("/v1/engagements", async (req) => {
    const { orgId } = req.query as { orgId?: string };
    return prisma.engagement.findMany({
      where: orgId ? { clientId: orgId } : {},
      include: { projects: { select: { id: true, name: true, status: true } } },
    });
  });

  // /v1/engagements/:id
  app.get("/v1/engagements/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const eng = await prisma.engagement.findUnique({
      where: { id },
      include: { projects: true, contracts: true },
    });
    if (!eng) return reply.code(404).send({ error: "Not found" });
    return eng;
  });

  // /v1/projects
  app.get("/v1/projects", async (req) => {
    const { engId, status } = req.query as { engId?: string; status?: string };
    const where: any = {};
    if (engId) where.engagementId = engId;
    if (status) where.status = status;
    return prisma.project.findMany({
      where,
      include: { milestones: { orderBy: { number: "asc" } } },
    });
  });

  // /v1/projects/:id
  app.get("/v1/projects/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const project = await prisma.project.findUnique({
      where: { id },
      include: { milestones: true, changeRequests: true },
    });
    if (!project) return reply.code(404).send({ error: "Not found" });
    return project;
  });

  // /v1/invoices
  app.get("/v1/invoices", async (req) => {
    const { engId, status } = req.query as { engId?: string; status?: string };
    const where: any = {};
    if (engId) where.engagementId = engId;
    if (status) where.status = status;
    return prisma.invoice.findMany({ where, orderBy: { createdAt: "desc" } });
  });

  // /v1/invoices/:id
  app.get("/v1/invoices/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const inv = await prisma.invoice.findUnique({ where: { id } });
    if (!inv) return reply.code(404).send({ error: "Not found" });
    return inv;
  });

  // /v1/tickets
  app.get("/v1/tickets", async (req) => {
    const { projectId, status } = req.query as { projectId?: string; status?: string };
    const where: any = {};
    if (projectId) where.projectId = projectId;
    if (status) where.status = status;
    return prisma.ticket.findMany({ where, orderBy: { createdAt: "desc" } });
  });

  // /v1/tickets/:id
  app.get("/v1/tickets/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) return reply.code(404).send({ error: "Not found" });
    return ticket;
  });

  // /v1/events
  app.get("/v1/events", async (req) => {
    const { engId, since, limit = "100" } = req.query as Record<string, string>;
    const where: any = {};
    if (engId) where.engagementId = engId;
    if (since) where.createdAt = { gte: new Date(since) };
    return prisma.event.findMany({
      where,
      take: parseInt(limit),
      orderBy: { createdAt: "desc" },
    });
  });

  // /v1/webhooks
  app.post("/v1/webhooks", async (req) => {
    const body = req.body as any;
    return prisma.webhookEndpoint.create({
      data: {
        orgId: body.orgId,
        url: body.url,
        // Each endpoint gets its own signing secret so a leak from one
        // subscriber cannot be used to forge deliveries to another.
        secret: randomBytes(32).toString("hex"),
        events: body.events ?? [],
        active: true,
      },
    });
  });

  app.get("/v1/webhooks", async (req) => {
    const { orgId } = req.query as { orgId: string };
    return prisma.webhookEndpoint.findMany({ where: { orgId } });
  });

  app.delete("/v1/webhooks/:id", async (req) => {
    const { id } = req.params as { id: string };
    await prisma.webhookEndpoint.delete({ where: { id } });
    return { success: true };
  });

  // /v1/health
  app.get("/v1/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));
}
