import type { FastifyInstance } from "fastify";
import { prisma } from "@stackfox/prisma";
import { requireAuth, requireRole } from "../plugins/auth";

export async function projectInquiryRoutes(app: FastifyInstance) {
  app.get("/project-inquiries", async (req, reply) => {
    if (!requireRole(req, reply, ["ADMIN", "SE", "SENIOR_PM"])) return;
    const { status, page = "1", limit = "20" } = req.query as Record<string, string>;
    const where: any = {};
    if (status && status !== "all") where.status = status;

    const [items, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
        orderBy: { createdAt: "desc" },
      }),
      prisma.lead.count({ where }),
    ]);

    return { data: items, meta: { pagination: { total, page: parseInt(page), limit: parseInt(limit) } } };
  });

  app.patch("/project-inquiries/:id/status", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { id } = req.params as { id: string };
    const { status } = req.body as { status: string };

    const valid = ["NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "LOST"];
    if (!valid.includes(status)) {
      return reply.code(400).send({ message: `Invalid status. Must be one of: ${valid.join(", ")}` });
    }

    const updated = await prisma.lead.update({
      where: { id },
      data: { status, updatedAt: new Date() },
    });

    return { data: updated };
  });
}
