import type { FastifyInstance } from "fastify";
import { prisma } from "@stackfox/prisma";
import { cache } from "../lib/redis";
import { readRawCatalogue } from "../lib/catalogue";

export async function catalogueRoutes(app: FastifyInstance) {
  // GET /catalogue/services
  app.get("/catalogue/services", async (req) => {
    const { category, status, page = "1", limit = "20" } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where: any = {};
    if (category) where.categoryTier1 = category;
    if (status) where.status = status;
    else where.status = "PUBLISHED";

    const [items, total] = await Promise.all([
      prisma.serviceUnit.findMany({ where, skip, take: parseInt(limit), orderBy: { name: "asc" } }),
      prisma.serviceUnit.count({ where }),
    ]);

    return { items, total, page: parseInt(page), limit: parseInt(limit) };
  });

  // GET /catalogue/services/:id
  app.get("/catalogue/services/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const cached = await cache.get(`service:${id}`);
    if (cached) return cached;

    const service = await prisma.serviceUnit.findUnique({
      where: { id },
      include: {
        featureUnits: { orderBy: { sortOrder: "asc" } },
        sdpVersions: { where: { publishedAt: { not: null } }, orderBy: { version: "desc" }, take: 1 },
        depsFrom: { include: { to: true } },
        packages: true,
      },
    });
    if (!service) return reply.code(404).send({ error: "Service not found" });

    await cache.set(`service:${id}`, service, 600);
    return service;
  });

  // GET /catalogue/services/:id/features
  app.get("/catalogue/services/:id/features", async (req) => {
    const { id } = req.params as { id: string };
    return prisma.featureUnit.findMany({
      where: { serviceId: id },
      orderBy: { sortOrder: "asc" },
    });
  });

  // GET /catalogue/categories
  app.get("/catalogue/categories", async () => {
    const cached = await cache.get("categories");
    if (cached) return cached;

    const services = await prisma.serviceUnit.findMany({
      where: { status: "PUBLISHED" },
      select: { categoryTier1: true, categoryTier2: true },
    });

    const tree: Record<string, Set<string>> = {};
    for (const s of services) {
      if (!tree[s.categoryTier1]) tree[s.categoryTier1] = new Set();
      if (s.categoryTier2) tree[s.categoryTier1].add(s.categoryTier2);
    }

    const result = Object.entries(tree).map(([tier1, tier2s]) => ({
      tier1,
      tier2: [...tier2s],
    }));

    await cache.set("categories", result, 3600);
    return result;
  });

  // GET /catalogue/bundles
  app.get("/catalogue/bundles", async () => {
    return prisma.bundle.findMany({ where: { status: "ACTIVE" } });
  });

  // GET /catalogue/search?q=
  app.get("/catalogue/search", async (req) => {
    const { q } = req.query as { q: string };
    if (!q || q.length < 2) return { items: [] };

    // Meilisearch proxy
    const meiliUrl = process.env.MEILI_URL ?? "http://localhost:7700";
    const meiliKey = process.env.MEILI_MASTER_KEY ?? "";

    try {
      const res = await fetch(`${meiliUrl}/indexes/services/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${meiliKey}`,
        },
        body: JSON.stringify({ q, limit: 20 }),
      });
      return res.json();
    } catch {
      // Fallback to Prisma full-text
      const items = await prisma.serviceUnit.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { slug: { contains: q, mode: "insensitive" } },
          ],
          status: "PUBLISHED",
        },
        take: 20,
      });
      return { items };
    }
  });

  // GET /catalogue/rate-card
  app.get("/catalogue/rate-card", async () => {
    const cached = await cache.get("rate-card");
    if (cached) return cached;

    const rates = await prisma.rateCard.findMany({
      orderBy: { effectiveFrom: "desc" },
    });

    // Group by type and get latest
    const latest: Record<string, any> = {};
    for (const r of rates) {
      const key = `${r.type}:${r.key}`;
      if (!latest[key]) latest[key] = r;
    }

    const result = {
      pointRate: latest["POINT:point"]?.rate ?? 280000, // ₹2,800 in paise
      roleRates: Object.entries(latest)
        .filter(([k]) => k.startsWith("ROLE:"))
        .map(([, v]) => v),
    };

    await cache.set("rate-card", result, 3600);
    return result;
  });

  // American-spelling aliases used by the client app
  app.get("/catalog/services", async (req, reply) => {
    const { category, status, page = "1", limit = "20" } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where: any = {};
    if (category) where.categoryTier1 = category;
    if (status) where.status = status;
    else where.status = "PUBLISHED";
    const [items, total] = await Promise.all([
      prisma.serviceUnit.findMany({ where, skip, take: parseInt(limit), orderBy: { name: "asc" } }),
      prisma.serviceUnit.count({ where }),
    ]);
    return { items, total, page: parseInt(page), limit: parseInt(limit) };
  });

  app.get("/catalog/categories", async () => {
    // Cache is best-effort — a Redis outage shouldn't take down category
    // listing, which is cheap to compute directly from the DB anyway.
    const cached = await cache.get("categories").catch(() => null);
    if (cached) return cached;
    const services = await prisma.serviceUnit.findMany({
      where: { status: "PUBLISHED" },
      select: { categoryTier1: true, categoryTier2: true },
    });
    const tree: Record<string, Set<string>> = {};
    for (const s of services) {
      if (!tree[s.categoryTier1]) tree[s.categoryTier1] = new Set();
      if (s.categoryTier2) tree[s.categoryTier1].add(s.categoryTier2);
    }
    const result = Object.entries(tree).map(([tier1, tier2s]) => ({
      tier1,
      tier2: [...tier2s],
    }));
    await cache.set("categories", result, 3600).catch(() => {});
    return result;
  });

  app.get("/catalog/packages", async () => {
    // Package has no status field — it's a fixed-price SKU tied to a
    // published ServiceUnit, not something with its own lifecycle state.
    return prisma.package.findMany();
  });

  app.get("/catalog/bundles", async () => {
    return prisma.bundle.findMany({ where: { status: "ACTIVE" } });
  });

  app.get("/catalogue/storefront", async (req, reply) => {
    const raw = readRawCatalogue();
    if (!raw) return reply.code(500).send({ error: "Catalogue not found" });
    return reply.type("application/json").send(raw);
  });
}
