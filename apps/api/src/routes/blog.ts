import type { FastifyInstance } from "fastify";
import { prisma } from "@stackfox/prisma";
import { requireAuth, requireRole } from "../plugins/auth";
import { isInternalRole } from "@stackfox/core";
import { generateStructured } from "../lib/gemini";
import { ok, withId, withIds, paginated, pageParams } from "../lib/http";
import { sanitizeHtml } from "../lib/sanitizeHtml";

/**
 * Blog and knowledge base.
 *
 * This module used to serve a hard-coded array of five posts, and its write
 * routes returned "will be available soon" without touching the database — so
 * the admin Content panel appeared to create, edit and delete posts while
 * nothing persisted, and anything published there never reached the public
 * site. Every route below reads and writes the `BlogPost` table.
 *
 * `status` separates what the public sees (PUBLISHED) from editorial states
 * (DRAFT, SUGGESTED by a team member, ARCHIVED).
 */

const EDITOR_ROLES = ["ADMIN", "SUPER_ADMIN", "SALES", "SENIOR_PM"];

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

/** Slugs are unique-indexed; suffix on collision rather than failing the write. */
async function uniqueSlug(base: string, ignoreId?: string): Promise<string> {
  const root = slugify(base) || `post-${Date.now()}`;
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const clash = await prisma.blogPost.findUnique({ where: { slug: candidate } });
    if (!clash || clash.id === ignoreId) return candidate;
  }
  return `${root}-${Date.now()}`;
}

/** The public shape: an author object, as the site templates expect. */
function serialize(post: any) {
  return {
    ...post,
    _id: post.id,
    author: { name: post.author ?? "StackFox", avatar: null },
  };
}

export async function blogRoutes(app: FastifyInstance) {
  // ── Public ────────────────────────────────────────────────────────────────

  app.get("/blog", async (req) => {
    const q = req.query as Record<string, string>;
    const { page, limit, skip } = pageParams(q, 20, 100);

    const where: any = { status: "PUBLISHED", publishedAt: { lte: new Date() } };
    if (q.featured !== undefined) where.featured = q.featured === "true";
    if (q.category && q.category !== "all") where.category = q.category;
    if (q.search) {
      where.OR = [
        { title: { contains: q.search, mode: "insensitive" } },
        { excerpt: { contains: q.search, mode: "insensitive" } },
      ];
    }

    const [posts, total] = await Promise.all([
      prisma.blogPost.findMany({ where, orderBy: { publishedAt: "desc" }, skip, take: limit }),
      prisma.blogPost.count({ where }),
    ]);

    return {
      data: posts.map(serialize),
      total,
      meta: { pagination: { total, page, limit, pages: Math.ceil(total / limit) } },
    };
  });

  app.get("/blog/categories", async () => {
    const rows = await prisma.blogPost.groupBy({
      by: ["category"],
      where: { status: "PUBLISHED" },
      _count: true,
    });
    return ok(
      rows
        .filter((r) => r.category)
        .map((r) => ({ category: r.category as string, count: r._count })),
    );
  });

  // ── Editorial listing (must precede /blog/:id so "admin" is not read as an id) ──

  app.get("/blog/admin/all", async (req, reply) => {
    if (!requireRole(req, reply, EDITOR_ROLES)) return;
    const q = req.query as Record<string, string>;
    const { page, limit, skip } = pageParams(q, 50, 200);

    const where: any = {};
    if (q.status && q.status !== "all") where.status = q.status;

    const [posts, total] = await Promise.all([
      prisma.blogPost.findMany({ where, orderBy: { publishedAt: "desc" }, skip, take: limit }),
      prisma.blogPost.count({ where }),
    ]);
    return paginated(posts.map(serialize), total, page, limit);
  });

  app.get("/blog/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const post = await prisma.blogPost.findFirst({ where: { OR: [{ id }, { slug: id }] } });
    if (!post) return reply.code(404).send({ error: "Post not found" });

    // Unpublished drafts are visible to staff only.
    if (post.status !== "PUBLISHED" && !isInternalRole(req.user?.role)) {
      return reply.code(404).send({ error: "Post not found" });
    }
    return ok(serialize(post));
  });

  // ── Suggestions from the team knowledge base ──────────────────────────────

  app.post("/blog/suggest", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { title, content, category } = req.body as {
      title?: string;
      content?: string;
      category?: string;
    };
    if (!title?.trim() || !content?.trim()) {
      return reply.code(400).send({ message: "title and content are required" });
    }

    const author = await prisma.user.findUnique({
      where: { id: req.user!.sub },
      select: { name: true },
    });

    // Persisted as a SUGGESTED post so it shows up in the editorial queue,
    // rather than being echoed back and discarded.
    const cleanContent = sanitizeHtml(content.trim());
    const post = await prisma.blogPost.create({
      data: {
        title: title.trim(),
        slug: await uniqueSlug(title),
        excerpt: cleanContent.slice(0, 160),
        content: cleanContent,
        category: category?.trim() || "General",
        status: "SUGGESTED",
        suggestedBy: req.user!.sub,
        author: author?.name ?? null,
        featured: false,
      },
    });

    return ok(serialize(post), {
      message: "Article suggestion received. An editor will review it.",
    });
  });

  // ── Editorial writes ──────────────────────────────────────────────────────

  app.post("/blog", async (req, reply) => {
    if (!requireRole(req, reply, EDITOR_ROLES)) return;
    const body = (req.body ?? {}) as Record<string, any>;
    if (!body.title?.trim() || !body.content?.trim()) {
      return reply.code(400).send({ message: "title and content are required" });
    }

    const status = ["DRAFT", "PUBLISHED", "SUGGESTED", "ARCHIVED"].includes(body.status)
      ? body.status
      : "DRAFT";

    const cleanContent = sanitizeHtml(body.content);
    const post = await prisma.blogPost.create({
      data: {
        title: body.title.trim(),
        slug: await uniqueSlug(body.slug || body.title),
        excerpt: sanitizeHtml(body.excerpt?.trim() || "") || cleanContent.slice(0, 160),
        content: cleanContent,
        category: body.category?.trim() || "General",
        featured: Boolean(body.featured),
        status,
        author: body.author?.trim() || null,
        coverImage: body.coverImage?.trim() || null,
        tags: Array.isArray(body.tags) ? body.tags.filter((t: unknown) => typeof t === "string") : [],
        publishedAt: body.publishedAt ? new Date(body.publishedAt) : new Date(),
      },
    });

    return ok(serialize(post));
  });

  app.put("/blog/:id", async (req, reply) => {
    if (!requireRole(req, reply, EDITOR_ROLES)) return;
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as Record<string, any>;

    const existing = await prisma.blogPost.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: "Post not found" });

    const data: Record<string, unknown> = {};
    if (typeof body.title === "string" && body.title.trim()) {
      data.title = body.title.trim();
      // Only re-slug when the title actually moved, so published URLs are stable.
      if (body.title.trim() !== existing.title) {
        data.slug = await uniqueSlug(body.slug || body.title, id);
      }
    }
    if (typeof body.slug === "string" && body.slug.trim() && body.slug !== existing.slug) {
      data.slug = await uniqueSlug(body.slug, id);
    }
    if (typeof body.content === "string") data.content = sanitizeHtml(body.content);
    if (typeof body.excerpt === "string") data.excerpt = sanitizeHtml(body.excerpt.trim());
    if (typeof body.category === "string") data.category = body.category.trim();
    if (typeof body.featured === "boolean") data.featured = body.featured;
    if (typeof body.author === "string") data.author = body.author.trim() || null;
    if (typeof body.coverImage === "string") data.coverImage = body.coverImage.trim() || null;
    if (Array.isArray(body.tags)) {
      data.tags = body.tags.filter((t: unknown) => typeof t === "string");
    }
    if (["DRAFT", "PUBLISHED", "SUGGESTED", "ARCHIVED"].includes(body.status)) {
      data.status = body.status;
      // Going live for the first time stamps the publication date.
      if (body.status === "PUBLISHED" && existing.status !== "PUBLISHED") {
        data.publishedAt = new Date();
      }
    }

    if (Object.keys(data).length === 0) {
      return reply.code(400).send({ message: "No updatable fields were supplied." });
    }

    const post = await prisma.blogPost.update({ where: { id }, data });
    return ok(serialize(post));
  });

  app.delete("/blog/:id", async (req, reply) => {
    if (!requireRole(req, reply, EDITOR_ROLES)) return;
    const { id } = req.params as { id: string };

    const existing = await prisma.blogPost.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: "Post not found" });

    await prisma.blogPost.delete({ where: { id } });
    return ok({ success: true, id });
  });

  /**
   * Drafts a post with the LLM and saves it as a DRAFT for an editor to review.
   * It never publishes directly — generated copy goes out under the company
   * name and needs a human in the loop.
   */
  app.post(
    "/blog/generate",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (req, reply) => {
      if (!requireRole(req, reply, EDITOR_ROLES)) return;
      const { topic, category } = req.body as { topic?: string; category?: string };
      if (!topic?.trim()) return reply.code(400).send({ message: "topic is required" });

      if (!process.env.GEMINI_API_KEY) {
        return reply.code(503).send({
          message: "Article generation is unavailable: no AI provider is configured.",
        });
      }

      const prompt = `Write a technical blog post for StackFox, an Indian IT services company, on: "${topic}".
Audience: founders and technology leads at Indian SMEs.
Tone: practical and specific, no filler, no marketing hype.
Return JSON with: title, excerpt (under 160 characters), content (800-1200 words of markdown), tags (3-6 lowercase strings).`;

      let draft: {
        title?: string;
        excerpt?: string;
        content?: string;
        tags?: string[];
      };
      try {
        draft = await generateStructured(prompt);
      } catch (err) {
        req.log.error({ err }, "Blog generation failed");
        return reply.code(502).send({
          message: "The AI provider could not generate an article. Please try again.",
        });
      }

      if (!draft?.title || !draft?.content) {
        return reply.code(502).send({ message: "The generated article was incomplete." });
      }

      const post = await prisma.blogPost.create({
        data: {
          title: draft.title,
          slug: await uniqueSlug(draft.title),
          excerpt: draft.excerpt?.slice(0, 200) ?? draft.content.slice(0, 160),
          content: sanitizeHtml(draft.content),
          category: category?.trim() || "General",
          status: "DRAFT",
          featured: false,
          author: "StackFox AI",
          tags: Array.isArray(draft.tags)
            ? draft.tags.filter((t): t is string => typeof t === "string").slice(0, 6)
            : [topic.toLowerCase()],
        },
      });

      return ok(serialize(post), { message: "Draft created — review it before publishing." });
    },
  );
}
