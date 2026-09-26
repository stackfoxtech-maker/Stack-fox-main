import type { FastifyInstance } from "fastify";
import { prisma } from "@stackfox/prisma";
import { requireRole } from "../plugins/auth";
import { bumpSessionEpoch } from "../lib/session";
import { LIST_CAP, pageParams, paginated } from "../lib/http";
import {
  CATALOGUE_ROLES,
  CLIENT_ROLES,
  INTERNAL_ROLES,
  isAdminRole,
  isInternalRole,
} from "@stackfox/core";
import { ok, withId } from "../lib/http";
import { parseBody } from "../lib/validate";
import { ScreeningReviewSchema } from "./opsSchemas";
import {
  CreateServiceSchema,
  UpdateServiceSchema,
  CreateFeatureSchema,
  UpdateFeatureSchema,
  CreateDependencySchema,
  CreateBundleSchema,
  UpdateBundleSchema,
  CreateRateCardSchema,
  UpdateRateCardSchema,
  CreateFlagSchema,
  UpdateFlagSchema,
  CreateNotificationTemplateSchema,
  UpdateNotificationTemplateSchema,
  CreateComplianceItemSchema,
  UpdateComplianceItemSchema,
} from "./adminSchemas";
import {
  updateServiceNameInCatalogue,
  addServiceToCatalogue,
  removeServiceFromCatalogue,
} from "../lib/catalogue";

const ALL_ROLES = [...INTERNAL_ROLES, ...CLIENT_ROLES] as readonly string[];

export async function adminRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (req, reply) => {
    if (!requireRole(req, reply, CATALOGUE_ROLES)) return;
  });

  /**
   * Admin list endpoints are paginated and searched **in the database**.
   *
   * They previously were not, and the admin Catalog page paid for it: it asked
   * for `limit=500`, services capped it at 200 of 258 rows, and the other four
   * tabs had no `take` at all — /admin/features returned all 809 rows (183 kB)
   * on every tab switch and again after every create, edit and delete.
   *
   * Worse than the volume, the truncation was silent and the search box only
   * filtered what had already been downloaded. So 58 services were invisible in
   * the UI *and* unfindable by searching for them.
   *
   * `q` filters server-side. Every one of these returns the same
   * `{ data, meta.pagination }` envelope, so the client can page through
   * without knowing which endpoint it is talking to.
   */
  function searchTerm(req: { query: unknown }): string | undefined {
    const q = (req.query as Record<string, string | undefined>).q?.trim();
    return q ? q : undefined;
  }

  /** Case-insensitive "contains" across the fields a human would search by. */
  function contains(q: string | undefined, fields: string[]) {
    if (!q) return {};
    return {
      OR: fields.map((f) => ({
        [f]: { contains: q, mode: "insensitive" as const },
      })),
    };
  }

  // Service CRUD
  app.get("/admin/services", async (req) => {
    const { page, limit, skip } = pageParams(
      req.query as Record<string, string>,
      50,
      LIST_CAP,
    );
    const where = contains(searchTerm(req), ["name", "id", "categoryTier1"]);
    const [items, total] = await Promise.all([
      prisma.serviceUnit.findMany({ where, skip, take: limit, orderBy: { id: "asc" } }),
      prisma.serviceUnit.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  });

  app.post("/admin/services", async (req, reply) => {
    const body = parseBody(req, reply, CreateServiceSchema);
    if (!body) return;
    const created = await prisma.serviceUnit.create({ data: body });
    try {
      addServiceToCatalogue({
        id: created.id,
        name: created.name,
        categoryTier1: created.categoryTier1,
        starterPrice: Number(created.starterPrice ?? 0),
        starterTimelineDays: created.starterTimelineDays,
      });
    } catch (err) {
      // The row is committed either way; the catalogue is a derived index.
      // Silence here meant search kept serving a service that no longer
      // matched the database, with nothing to show why.
      req.log.warn({ err, serviceId: created.id }, "catalogue add failed");
    }
    return created;
  });

  app.patch("/admin/services/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = parseBody(req, reply, UpdateServiceSchema);
    if (!body) return;
    const existing = await prisma.serviceUnit.findUnique({ where: { id } });
    const updated = await prisma.serviceUnit.update({ where: { id }, data: body });
    if (existing && body.name && body.name !== existing.name) {
      try {
        updateServiceNameInCatalogue(id, body.name);
      } catch (err) {
        req.log.warn({ err, serviceId: id }, "catalogue rename failed");
      }
    }
    return updated;
  });

  app.delete("/admin/services/:id", async (req) => {
    const { id } = req.params as { id: string };
    await prisma.serviceUnit.delete({ where: { id } });
    try {
      removeServiceFromCatalogue(id);
    } catch (err) {
      req.log.warn({ err, serviceId: id }, "catalogue removal failed");
    }
    return { success: true };
  });

  // Feature CRUD
  app.get("/admin/features", async (req) => {
    const { serviceId } = req.query as { serviceId?: string };
    const { page, limit, skip } = pageParams(
      req.query as Record<string, string>,
      50,
      LIST_CAP,
    );
    const where = {
      ...(serviceId ? { serviceId } : {}),
      ...contains(searchTerm(req), ["name", "id", "serviceId"]),
    };
    const [items, total] = await Promise.all([
      prisma.featureUnit.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ serviceId: "asc" }, { sortOrder: "asc" }],
      }),
      prisma.featureUnit.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  });

  app.post("/admin/features", async (req, reply) => {
    const body = parseBody(req, reply, CreateFeatureSchema);
    if (!body) return;
    return prisma.featureUnit.create({ data: body });
  });

  app.patch("/admin/features/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = parseBody(req, reply, UpdateFeatureSchema);
    if (!body) return;
    return prisma.featureUnit.update({ where: { id }, data: body });
  });

  app.delete("/admin/features/:id", async (req) => {
    const { id } = req.params as { id: string };
    await prisma.featureUnit.delete({ where: { id } });
    return { success: true };
  });

  // Dependency CRUD
  app.get("/admin/dependencies", async (req) => {
    const { page, limit, skip } = pageParams(
      req.query as Record<string, string>,
      50,
      LIST_CAP,
    );
    const where = contains(searchTerm(req), ["fromId", "toId", "type"]);
    const [items, total] = await Promise.all([
      prisma.dependency.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ fromId: "asc" }, { toId: "asc" }],
      }),
      prisma.dependency.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  });

  app.post("/admin/dependencies", async (req, reply) => {
    const body = parseBody(req, reply, CreateDependencySchema);
    if (!body) return;
    return prisma.dependency.create({ data: body });
  });

  app.delete("/admin/dependencies/:id", async (req) => {
    const { id } = req.params as { id: string };
    await prisma.dependency.delete({ where: { id } });
    return { success: true };
  });

  // Bundle CRUD
  app.get("/admin/bundles", async (req) => {
    const { page, limit, skip } = pageParams(
      req.query as Record<string, string>,
      50,
      LIST_CAP,
    );
    const where = contains(searchTerm(req), ["name", "id", "status"]);
    const [items, total] = await Promise.all([
      prisma.bundle.findMany({ where, skip, take: limit, orderBy: { id: "asc" } }),
      prisma.bundle.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  });

  app.post("/admin/bundles", async (req, reply) => {
    const body = parseBody(req, reply, CreateBundleSchema);
    if (!body) return;
    return prisma.bundle.create({ data: body });
  });

  app.patch("/admin/bundles/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = parseBody(req, reply, UpdateBundleSchema);
    if (!body) return;
    return prisma.bundle.update({ where: { id }, data: body });
  });

  app.delete("/admin/bundles/:id", async (req) => {
    const { id } = req.params as { id: string };
    await prisma.bundle.delete({ where: { id } });
    return { success: true };
  });

  // Rate Card CRUD
  app.get("/admin/rate-cards", async (req) => {
    const { page, limit, skip } = pageParams(
      req.query as Record<string, string>,
      50,
      LIST_CAP,
    );
    const where = contains(searchTerm(req), ["key", "type"]);
    const [items, total] = await Promise.all([
      prisma.rateCard.findMany({
        where,
        skip,
        take: limit,
        orderBy: { effectiveFrom: "desc" },
      }),
      prisma.rateCard.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  });

  app.post("/admin/rate-cards", async (req, reply) => {
    const body = parseBody(req, reply, CreateRateCardSchema);
    if (!body) return;
    return prisma.rateCard.create({ data: body });
  });

  app.patch("/admin/rate-cards/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = parseBody(req, reply, UpdateRateCardSchema);
    if (!body) return;
    return prisma.rateCard.update({ where: { id }, data: body });
  });

  // Flags CRUD
  app.get("/admin/flags", async () => {
    return prisma.flag.findMany();
  });

  app.post("/admin/flags", async (req, reply) => {
    const body = parseBody(req, reply, CreateFlagSchema);
    if (!body) return;
    return prisma.flag.create({ data: body });
  });

  app.patch("/admin/flags/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = parseBody(req, reply, UpdateFlagSchema);
    if (!body) return;
    return prisma.flag.update({ where: { id }, data: body });
  });

  // Notification Templates — NotificationContent rows are all templates
  // (one per event_code.channel key), there's no separate "isTemplate" flag.
  app.get("/admin/notification-templates", async () => {
    return prisma.notificationContent.findMany({ orderBy: { key: "asc" } });
  });

  app.post("/admin/notification-templates", async (req, reply) => {
    const body = parseBody(req, reply, CreateNotificationTemplateSchema);
    if (!body) return;
    return prisma.notificationContent.create({ data: body });
  });

  app.patch("/admin/notification-templates/:key", async (req, reply) => {
    const { key } = req.params as { key: string };
    const body = parseBody(req, reply, UpdateNotificationTemplateSchema);
    if (!body) return;
    return prisma.notificationContent.update({ where: { key }, data: body });
  });

  // User management
  app.get("/admin/users", async (req) => {
    const { page = "1", limit = "50", role } = req.query as Record<string, string>;
    const where: any = {};
    if (role) where.role = role;
    const { page: p, limit: l, skip } = pageParams({ page, limit }, 50, 200);
    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: l,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          orgId: true,
          isActive: true,
          createdAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);
    return paginated(items, total, p, l);
  });

  app.patch("/admin/users/:id", async (req, reply) => {
    // The plugin-level guard also admits SE and SENIOR_PM. Spreading the raw
    // body into `data` therefore let either of them set any column — including
    // promoting themselves to ADMIN. Only true admins may change a role, and
    // only an allowlist of fields is writable at all.
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as Record<string, unknown>;

    // The tree-level guard also admits SE and SENIOR_PM. Role changes were
    // already restricted below, but isActive and orgId were not — so a
    // mid-level staff account could deactivate every administrator, and the
    // bumpSessionEpoch at the end made that lockout immediate.
    const callerIsAdmin = isAdminRole(req.user!.role);
    const target = await prisma.user.findUnique({
      where: { id },
      select: { role: true },
    });
    if (!target) return reply.code(404).send({ error: "User not found" });

    if ((body.isActive !== undefined || body.orgId !== undefined) && !callerIsAdmin) {
      return reply.code(403).send({
        error: "Only an administrator can change a user's status or organisation.",
      });
    }
    // Nobody may act on an account that outranks them, whatever the field.
    if (!callerIsAdmin && isInternalRole(target.role)) {
      return reply
        .code(403)
        .send({ error: "Insufficient permissions for this account." });
    }

    const data: Record<string, unknown> = {};
    if (typeof body.name === "string") data.name = body.name;
    if (typeof body.phone === "string") data.phone = body.phone;
    if (typeof body.isActive === "boolean") data.isActive = body.isActive;
    if (typeof body.orgId === "string" || body.orgId === null) data.orgId = body.orgId;

    if (body.role !== undefined) {
      if (!callerIsAdmin) {
        return reply
          .code(403)
          .send({ error: "Only an administrator can change a user's role." });
      }
      if (typeof body.role !== "string" || !ALL_ROLES.includes(body.role)) {
        return reply.code(400).send({
          error: `Unknown role. Valid roles: ${ALL_ROLES.join(", ")}`,
        });
      }
      if (id === req.user!.sub && body.role !== req.user!.role) {
        return reply.code(409).send({ error: "You cannot change your own role." });
      }
      data.role = body.role;
    }

    if (Object.keys(data).length === 0) {
      return reply.code(400).send({ error: "No updatable fields were supplied." });
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        orgId: true,
        isActive: true,
      },
    });

    // A role change or a deactivation must not leave a stale session live.
    if (data.role !== undefined || data.isActive === false) {
      await bumpSessionEpoch(id).catch(() => {});
    }
    return ok(withId(updated));
  });

  // Screening queue — HOLD means "needs manual review"; PASS/FAIL are resolved.
  app.get("/admin/screening", async () => {
    return prisma.screeningResult.findMany({
      where: { result: "HOLD" },
      orderBy: { createdAt: "asc" },
    });
  });

  app.patch("/admin/screening/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const srBody = parseBody(req, reply, ScreeningReviewSchema);
    if (!srBody) return;
    const { result, reviewNote } = srBody;
    return prisma.screeningResult.update({
      where: { id },
      data: { result, reviewNote, reviewedBy: req.user!.sub, reviewedAt: new Date() },
    });
  });

  // SE queue
  app.get("/admin/se-queue", async () => {
    return prisma.workspace.findMany({
      where: { seStatus: "SE_QUEUE" },
      orderBy: { createdAt: "asc" },
    });
  });

  // Compliance calendar — statutory filings per org (GST/TDS/GSTR-1/SOFTEX/...)
  app.get("/admin/compliance", async (req) => {
    const { status } = req.query as { status?: string };
    return prisma.complianceItem.findMany({
      where: status ? { status } : {},
      include: { org: { select: { id: true, name: true } } },
      orderBy: { dueDate: "asc" },
    });
  });

  app.post("/admin/compliance", async (req, reply) => {
    const body = parseBody(req, reply, CreateComplianceItemSchema);
    if (!body) return;
    return prisma.complianceItem.create({ data: body });
  });

  app.patch("/admin/compliance/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = parseBody(req, reply, UpdateComplianceItemSchema);
    if (!body) return;
    return prisma.complianceItem.update({ where: { id }, data: body });
  });

  app.get("/admin/purchases", async (req) => {
    const { limit = "50", skip = "0", q } = req.query as Record<string, string>;
    const take = Math.min(parseInt(limit) || 50, 200);
    const skipNum = parseInt(skip) || 0;

    const [orders, paidQuotes] = await Promise.all([
      prisma.order.findMany({
        orderBy: { createdAt: "desc" },
        skip: skipNum,
        take: Math.ceil(take / 2),
        include: {
          org: {
            select: {
              id: true,
              name: true,
              type: true,
              gstin: true,
              gstinVerified: true,
              pan: true,
              billingAddress: true,
              contactEmail: true,
              contactPhone: true,
              tier: true,
              status: true,
              creditTier: true,
              healthState: true,
              kycStatus: true,
            },
          },
          estimate: {
            select: {
              id: true,
              snapshot: true,
              totals: true,
            },
          },
          contracts: {
            include: {
              signatures: {
                include: {
                  signer: {
                    select: { id: true, name: true, email: true },
                  },
                },
              },
            },
          },
          projects: {
            include: {
              service: {
                select: { id: true, name: true, categoryTier1: true },
              },
              milestones: {
                orderBy: { number: "asc" },
              },
            },
          },
          payments: {
            orderBy: { createdAt: "desc" },
          },
        },
      }),
      prisma.quote.findMany({
        where: { status: "paid" },
        orderBy: { createdAt: "desc" },
        skip: skipNum,
        take: Math.ceil(take / 2),
      }),
    ]);

    const orderEngIds = orders
      .map((o) => o.engagementId)
      .filter((id): id is string => Boolean(id));
    const engagements = await prisma.engagement.findMany({
      take: LIST_CAP,
      where: { id: { in: orderEngIds } },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            type: true,
            gstin: true,
            gstinVerified: true,
            pan: true,
            billingAddress: true,
            contactEmail: true,
            contactPhone: true,
            tier: true,
            status: true,
            creditTier: true,
            healthState: true,
            kycStatus: true,
          },
        },
        contracts: {
          include: {
            signatures: {
              include: {
                signer: {
                  select: { id: true, name: true, email: true },
                },
              },
            },
          },
        },
        projects: {
          include: {
            service: {
              select: { id: true, name: true, categoryTier1: true },
            },
            milestones: {
              orderBy: { number: "asc" },
            },
          },
        },
      },
    });
    const engagementById = new Map<string, any>(engagements.map((e) => [e.id, e]));

    const normalizeOrder = (o: any) => {
      const eng = o.engagementId ? engagementById.get(o.engagementId) : null;
      return {
        kind: "order" as const,
        id: o.id,
        date: o.createdAt,
        status: o.status,
        client: o.org,
        contact: o.primaryContact,
        items: (o.estimate?.snapshot?.canvas || []).map((c: any) => ({
          serviceId: c.serviceId,
          name: c.serviceId,
          quantity: 1,
        })),
        subtotal: o.estimate?.totals?.subtotal ?? o.subtotal ?? 0,
        gst: o.estimate?.totals?.gst ?? o.gst ?? 0,
        total: o.estimate?.totals?.grand ?? o.grandTotal ?? 0,
        paymentMode: o.paymentMode,
        paidAt: o.paidAt,
        razorpayOrderId: o.razorpayOrderId,
        engagement: eng,
        contracts: (eng?.contracts || []).sort(
          (a: any, b: any) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
        projects: (eng?.projects || []).sort(
          (a: any, b: any) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
        payments: o.payments,
      };
    };

    const normalizeQuote = (q: any) => ({
      kind: "quote" as const,
      id: q.id,
      quoteNumber: q.quoteNumber,
      date: q.createdAt,
      status: q.status,
      client: null,
      contact: null,
      items: (q.items || []).map((it: any) => ({
        serviceId: it.itemId,
        name: it.name,
        quantity: it.quantity || 1,
      })),
      subtotal: Number(q.subtotal) / 100,
      gst: Number(q.gstAmount) / 100,
      total: Number(q.total) / 100,
      tier: q.tier,
      paidAt: q.paidAt,
      razorpayOrderId: q.razorpayOrderId,
      engagement: null,
      contracts: [],
      projects: [],
      payments: [],
    });

    let purchases = [...orders.map(normalizeOrder), ...paidQuotes.map(normalizeQuote)];

    if (q && q.trim()) {
      const ql = q.toLowerCase();
      purchases = purchases.filter((p: any) => {
        const hay = [
          p.id,
          p.quoteNumber,
          p.client?.name,
          p.client?.id,
          p.contact?.email,
          p.contact?.name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(ql);
      });
    }

    purchases.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return { data: purchases, total: purchases.length };
  });
}
