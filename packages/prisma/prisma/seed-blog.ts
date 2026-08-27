/**
 * Seeds the five founding blog posts.
 *
 * These previously lived as a hard-coded array inside `apps/api/src/routes/blog.ts`
 * and were served directly, so the public blog was not backed by the database at
 * all. Now that `/blog` reads `BlogPost`, they need to exist as real rows.
 *
 * Idempotent — matches on slug, so re-running will not duplicate or clobber
 * edits made through the admin Content panel.
 *
 *   pnpm --filter @stackfox/prisma exec tsx prisma/seed-blog.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const POSTS = [
  {
    slug: "scaling-web-apps-2025",
    title: "Scaling Web Apps in 2025: From MVP to 100k Users",
    excerpt: "A deep dive into serverless architecture, database sharding, and why your first choice of tech stack matters more than you think.",
    category: "Development",
    featured: true,
    publishedAt: new Date("2025-12-15T00:00:00.000Z"),
    coverImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&q=80&auto=format&fit=crop",
    content: "Scaling a web application from a minimum viable product to handling 100,000 concurrent users is one of the most challenging journeys in software engineering...",
    tags: ["scaling", "architecture", "serverless"],
  },
  {
    slug: "ai-genai-business-efficiency",
    title: "How Generative AI is Changing Business Efficiency",
    excerpt: "Stop using ChatGPT as a toy. Learn how to integrate LLMs into your internal workflows to save 20+ hours a week.",
    category: "AI",
    featured: true,
    publishedAt: new Date("2025-11-28T00:00:00.000Z"),
    coverImage: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1200&q=80&auto=format&fit=crop",
    content: "Generative AI has moved far beyond chatbots and image generators. Forward-thinking businesses are now integrating large language models directly into their internal workflows...",
    tags: ["ai", "genai", "automation", "productivity"],
  },
  {
    slug: "mobile-first-india-growth",
    title: "Mobile-First Design: Winning the Indian Market",
    excerpt: "The average Indian user has a budget smartphone and intermittent 4G. Here is how to design apps that actually work.",
    category: "Design",
    featured: true,
    publishedAt: new Date("2025-11-10T00:00:00.000Z"),
    coverImage: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=1200&q=80&auto=format&fit=crop",
    content: "India's mobile-first market presents unique challenges that most Western design frameworks simply don't address...",
    tags: ["mobile", "design", "india", "ux"],
  },
  {
    slug: "devops-ci-cd-startup",
    title: "DevOps for Startups: CI/CD Without the Complexity",
    excerpt: "You don't need Kubernetes on day one. A pragmatic guide to shipping fast with GitHub Actions, Docker, and Railway.",
    category: "DevOps",
    featured: false,
    publishedAt: new Date("2025-10-20T00:00:00.000Z"),
    coverImage: "https://images.unsplash.com/photo-1667372393119-3d4c48d07fc9?w=1200&q=80&auto=format&fit=crop",
    content: "The DevOps landscape can feel overwhelming for a small team. But the truth is, you can achieve reliable deployments with a fraction of the tooling...",
    tags: ["devops", "ci-cd", "docker", "startup"],
  },
  {
    slug: "ecommerce-payments-india",
    title: "Payment Integration in India: Razorpay, Stripe & UPI",
    excerpt: "A technical comparison of payment gateways for Indian e-commerce, including UPI autopay, subscriptions, and compliance.",
    category: "E-Commerce",
    featured: false,
    publishedAt: new Date("2025-10-05T00:00:00.000Z"),
    coverImage: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1200&q=80&auto=format&fit=crop",
    content: "India's payment ecosystem is unique. UPI dominates consumer transactions, but enterprise billing still relies heavily on NEFT and RTGS...",
    tags: ["payments", "razorpay", "stripe", "upi", "ecommerce"],
  },
];

async function main() {
  let created = 0;
  let skipped = 0;

  for (const post of POSTS) {
    const existing = await prisma.blogPost.findUnique({ where: { slug: post.slug } });
    if (existing) {
      skipped++;
      console.log(`  exists: ${post.slug}`);
      continue;
    }
    await prisma.blogPost.create({
      data: { ...post, status: "PUBLISHED", author: "StackFox Engineering" },
    });
    created++;
    console.log(`  created: ${post.slug}`);
  }

  const total = await prisma.blogPost.count({ where: { status: "PUBLISHED" } });
  console.log(`\nDone. created=${created} skipped=${skipped}; ${total} published post(s) total.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
