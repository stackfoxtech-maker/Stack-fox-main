import type { FastifyInstance } from "fastify";
import { prisma } from "@stackfox/prisma";

export async function knowledgeRoutes(app: FastifyInstance) {
  app.get("/knowledge", async (req) => {
    const { limit, featured } = req.query as { limit?: string; featured?: string };
    // Only published articles are public; drafts and team suggestions are not.
    const where: any = { status: "PUBLISHED" };
    if (featured !== undefined) where.featured = featured === "true";

    const posts = await prisma.blogPost.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      take: limit ? parseInt(limit) : undefined,
    });
    return { data: posts, total: posts.length };
  });

  app.get("/knowledge/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const post = await prisma.blogPost.findFirst({
      where: { status: "PUBLISHED", OR: [{ id }, { slug: id }] },
    });
    if (!post) return reply.code(404).send({ error: "Article not found" });
    return { data: post };
  });
}
