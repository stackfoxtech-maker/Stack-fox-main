import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import { resolve } from "path";
import { createHash } from "crypto";

config({ path: resolve(__dirname, "../../..", ".env") });

import data from "../../../shared/stackfox-data.json";
const prisma = new PrismaClient();

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// ServiceUnit.slug is @unique, but shared/stackfox-data.json has 12 services
// all named "End-to-End Workflow Test (₹5)" (one placeholder per category), so
// slugify(name) collides and the seed hit P2002. Disambiguate deterministically
// with the (already-unique) service id — iteration order is stable, so a
// re-seed produces the same slugs.
const usedSlugs = new Set<string>();
function uniqueSlug(name: string, serviceId: string): string {
  const base = slugify(name) || serviceId.toLowerCase();
  if (!usedSlugs.has(base)) {
    usedSlugs.add(base);
    return base;
  }
  let candidate = `${base}-${serviceId.toLowerCase().replace(/^sf-/, "")}`;
  let n = 2;
  while (usedSlugs.has(candidate)) candidate = `${base}-${n++}`;
  usedSlugs.add(candidate);
  return candidate;
}

function categoryToTier1(catId: string): string {
  const map: Record<string, string> = {
    "web-dev": "WEB",
    "mobile-dev": "MOB",
    "ai-genai": "AI",
    automation: "AUTO",
    ecommerce: "ECOM",
    "ui-ux": "UI",
    "backend-api": "BE",
    devops: "DEVOPS",
    cybersecurity: "SEC",
    "seo-marketing": "SEO",
    "it-consulting": "CONSULT",
    saas: "SAAS",
    maintenance: "MAINT",
  };
  return map[catId] ?? catId.toUpperCase();
}

function sacCodeForCategory(catId: string): string {
  const map: Record<string, string> = {
    "web-dev": "998314",
    "mobile-dev": "998314",
    "ai-genai": "998314",
    automation: "998314",
    ecommerce: "998314",
    "ui-ux": "998314",
    "backend-api": "998314",
    devops: "998314",
    cybersecurity: "998315",
    "seo-marketing": "998365",
    "it-consulting": "998312",
    saas: "998314",
    maintenance: "998316",
  };
  return map[catId] ?? "998314";
}

async function seed() {
  console.log("🦊 Seeding StackFox database...");

  // ── 1. Service Units ──────────────────────────────
  console.log(`  → ${data.services.length} services...`);
  for (const svc of data.services) {
    const serviceId = `SF-${categoryToTier1(svc.catId)}-${svc.id.split("-").pop()?.padStart(3, "0")}`;
    const slug = uniqueSlug(svc.name, serviceId);
    await prisma.serviceUnit.upsert({
      where: { id: serviceId },
      update: {
        name: svc.name,
        categoryTier1: categoryToTier1(svc.catId),
        slug,
        baseWeight: Math.ceil(svc.price / 1000),
        sacCode: sacCodeForCategory(svc.catId),
        status: "PUBLISHED",
        starterPrice: svc.price * 100,
        starterTimelineDays: parseInt(svc.est) || 7,
        growthPreset: {
          priceMultiplier: 1.5,
          additionalFeatures: [],
        },
        premiumMinimum: svc.price * 100 * 2,
        premiumIncludes: {
          dedicatedPM: true,
          prioritySupport: true,
          sourceCode: true,
        },
      },
      create: {
        id: serviceId,
        name: svc.name,
        categoryTier1: categoryToTier1(svc.catId),
        slug,
        baseWeight: Math.ceil(svc.price / 1000),
        sacCode: sacCodeForCategory(svc.catId),
        status: "PUBLISHED",
        starterPrice: svc.price * 100,
        starterTimelineDays: parseInt(svc.est) || 7,
        growthPreset: {
          priceMultiplier: 1.5,
          additionalFeatures: [],
        },
        premiumMinimum: svc.price * 100 * 2,
        premiumIncludes: {
          dedicatedPM: true,
          prioritySupport: true,
          sourceCode: true,
        },
      },
    });

    // Create 3-5 feature units per service in parallel
    const featureCount = Math.min(5, Math.max(3, Math.ceil(svc.price / 10000)));
    const featureNames = generateFeatureNames(svc.name, svc.catId, featureCount);
    await Promise.all(
      featureNames.map((featureName, idx) => {
        const featureId = `${serviceId}-F${String(idx + 1).padStart(2, "0")}`;
        return prisma.featureUnit.upsert({
          where: { id: featureId },
          update: { name: featureName },
          create: {
            id: featureId,
            serviceId,
            name: featureName,
            description: `${featureName} for ${svc.name}`,
            weight: [1, 2, 3, 5, 8][idx % 5],
            defaultState: idx < 2,
            sortOrder: idx,
          },
        });
      })
    );
  }

  // ── 2. Bundles (from packages + industryBundles) ─────
  console.log(`  → ${data.packages.length} packages + ${data.industryBundles.length} industry bundles...`);
  for (const pkg of data.packages) {
    await prisma.bundle.upsert({
      where: { id: pkg.id },
      update: {
        name: pkg.name,
        members: pkg.items.map((itemId: string) => ({
          serviceId: itemId,
          features: [],
        })),
        discountPct: Math.round((pkg.savings / (pkg.price + pkg.savings)) * 100),
      },
      create: {
        id: pkg.id,
        name: pkg.name,
        members: pkg.items.map((itemId: string) => ({
          serviceId: itemId,
          features: [],
        })),
        discountPct: Math.round((pkg.savings / (pkg.price + pkg.savings)) * 100),
        status: "ACTIVE",
      },
    });
  }

  for (const bundle of data.industryBundles) {
    await prisma.bundle.upsert({
      where: { id: bundle.id },
      update: {
        name: bundle.name,
        members: bundle.items.map((itemId: string) => ({
          serviceId: itemId,
          features: [],
        })),
      },
      create: {
        id: bundle.id,
        name: bundle.name,
        members: bundle.items.map((itemId: string) => ({
          serviceId: itemId,
          features: [],
        })),
        discountPct: 15,
        status: "ACTIVE",
      },
    });
  }

  // ── 3. Rate Cards ─────────────────────────────────
  console.log("  → Rate cards...");
  const rates = [
    { type: "POINT", key: "point", rate: 50000 },
    { type: "ROLE", key: "junior-dev", rate: 150000 },
    { type: "ROLE", key: "senior-dev", rate: 300000 },
    { type: "ROLE", key: "lead-dev", rate: 450000 },
    { type: "ROLE", key: "designer", rate: 200000 },
    { type: "ROLE", key: "qa-engineer", rate: 180000 },
    { type: "ROLE", key: "devops-engineer", rate: 350000 },
    { type: "ROLE", key: "project-manager", rate: 250000 },
    { type: "ROLE", key: "solution-architect", rate: 500000 },
    { type: "ROLE", key: "ai-engineer", rate: 400000 },
  ];
  const effectiveFrom = new Date("2025-01-01");
  for (const r of rates) {
    await prisma.rateCard.upsert({
      where: {
        type_key_effectiveFrom: {
          type: r.type,
          key: r.key,
          effectiveFrom,
        },
      },
      update: { rate: r.rate },
      create: { ...r, effectiveFrom },
    });
  }

  // ── 4. Admin user ─────────────────────────────────
  console.log("  → Admin user...");
  // The original seed left the ADMIN account without a password, so a freshly
  // seeded instance had no way to sign in — the admin panel was unreachable.
  // We now set a real credential from ADMIN_PASSWORD (default documented below).
  // The digest is the legacy SHA-256 form on purpose: verifyPassword() still
  // accepts it, and silently upgrades the row to scrypt on the first login.
  const adminPassword = process.env.ADMIN_PASSWORD || "Admin@Stackfox2025";
  const adminPasswordHash = createHash("sha256").update(adminPassword).digest("hex");
  await prisma.user.upsert({
    where: { email: "admin@stackfox.tech" },
    update: {
      role: "ADMIN",
      // Only overwrite a stored password if it was never set (or it is a plain
      // placeholder) so an existing deploy that already set one keeps it.
      authData: {
        provider: "email",
        verified: true,
        passwordHash: adminPasswordHash,
      },
    },
    create: {
      name: "StackFox Admin",
      email: "admin@stackfox.tech",
      role: "ADMIN",
      authData: { provider: "email", verified: true, passwordHash: adminPasswordHash },
    },
  });

  // ── 5. Demo sales team users ───────────────────────
  console.log("  → Demo sales team users...");
  const salesPassword = process.env.SALES_PASSWORD || "Sales@Stackfox2025";
  const salesPasswordHash = createHash("sha256").update(salesPassword).digest("hex");
  const demoSalesUsers = [
    { name: "Sales Executive", email: "sales@stackfox.tech", role: "SE" },
    { name: "Senior Sales Manager", email: "sales.lead@stackfox.tech", role: "SENIOR_PM" },
    { name: "Sales Manager", email: "sales.manager@stackfox.tech", role: "SALES" },
  ];
  for (const u of demoSalesUsers) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        role: u.role,
        authData: {
          provider: "email",
          verified: true,
          passwordHash: salesPasswordHash,
        },
      },
      create: {
        name: u.name,
        email: u.email,
        role: u.role,
        authData: { provider: "email", verified: true, passwordHash: salesPasswordHash },
      },
    });
  }

  // ── 6. Feature flags ──────────────────────────────
  console.log("  → Feature flags...");
  const flags = [
    { key: "STARTER_CHECKOUT", enabled: true },
    { key: "AI_SCOPE_ADVISOR", enabled: true },
    { key: "WHATSAPP_COMMERCE", enabled: false },
    { key: "WEBSITE_AUDIT_TOOL", enabled: true },
    { key: "EXPRESS_CHECKOUT", enabled: true },
    { key: "REFERRAL_PROGRAM", enabled: false },
    { key: "MULTI_CURRENCY", enabled: true },
    { key: "GST_INVOICING", enabled: true },
  ];
  for (const flag of flags) {
    await prisma.featureFlag.upsert({
      where: { key: flag.key },
      update: { enabled: flag.enabled },
      create: {
        key: flag.key,
        enabled: flag.enabled,
        metadata: {},
      },
    });
  }

  // ── Blog posts ────────────────────────────────────
  // The blog moved from a hard-coded array to the BlogPost table; the seed
  // needs to plant the baseline published posts the public /blog serves.
  console.log("  → blog posts...");
  const posts = [
    {
      title: "Why we publish every price",
      category: "Philosophy",
      excerpt: "Agencies hide pricing behind a sales call. Here is why StackFox does the opposite.",
      content:
        "Most software agencies treat pricing as a negotiation. You describe your project, sit through two or three calls, and eventually receive a number you cannot sanity-check. We think that is backwards. Every one of our 240+ service pieces has a public price. You can assemble a plan, see the total — GST included — and only talk to us when the shape of it looks right.",
    },
    {
      title: "How to scope a web app without over-buying",
      category: "Guides",
      excerpt: "A short checklist for deciding what actually belongs in v1.",
      content:
        "The most expensive mistake in a first build is paying for scope you will not use for a year. Start from the one workflow that has to work on launch day and add only what that workflow needs. Auth, a database, the core screens, and a way to get data out. Everything else — analytics dashboards, admin tooling, a second user role — can wait until real usage tells you where the pressure is.",
    },
    {
      title: "GST, SAC codes and software invoices in India",
      category: "Finance",
      excerpt: "What the 998314 on your invoice means and when CGST+SGST becomes IGST.",
      content:
        "Software development in India is classified under SAC 998314 and attracts 18% GST. Whether that shows up as CGST+SGST (9% + 9%) or a single IGST line depends on place of supply: intra-state supplies split it, inter-state supplies use IGST. A registered buyer can claim the full amount as input tax credit, which is why a compliant tax invoice with both parties' GSTINs matters.",
    },
    {
      title: "Milestone-based payments, explained",
      category: "How we work",
      excerpt: "Why we bill in stages and what each stage buys you.",
      content:
        "A fixed-scope project is split into milestones, each worth a percentage of the total. You approve the work at each stage before the next payment is due, and each milestone includes two rounds of revisions. It keeps both sides honest: we do not get ahead of what has been signed off, and you never pay for a phase you have not seen.",
    },
    {
      title: "Handover: what you get on day one of ownership",
      category: "How we work",
      excerpt: "Source, credentials, docs and a 30-day warranty — the full kit.",
      content:
        "When a project is delivered you receive a handover kit: the full source repository, every production credential in an encrypted vault you control, deployment and architecture documentation, and a training session for your team. From acceptance, a 30-day warranty covers bug fixes and minor adjustments at no cost.",
    },
  ];
  for (const p of posts) {
    const slug = slugify(p.title); // 5 hand-picked, distinct titles
    await prisma.blogPost.upsert({
      where: { slug },
      update: { title: p.title, excerpt: p.excerpt, content: p.content, category: p.category, status: "PUBLISHED" },
      create: {
        title: p.title,
        slug,
        excerpt: p.excerpt,
        content: p.content,
        category: p.category,
        status: "PUBLISHED",
        author: "StackFox",
        tags: [],
      },
    });
  }

  console.log("✅ Seed complete!");
  console.log(`   Services: ${data.services.length}`);
  console.log(`   Bundles: ${data.packages.length + data.industryBundles.length}`);
  console.log(`   Rate cards: ${rates.length}`);
  console.log(`   Blog posts: ${posts.length}`);
}

function generateFeatureNames(
  serviceName: string,
  catId: string,
  count: number
): string[] {
  const templates: Record<string, string[]> = {
    "web-dev": [
      "Core Implementation",
      "Responsive Layout",
      "SEO Meta Tags",
      "Performance Optimization",
      "Cross-browser Testing",
    ],
    "mobile-dev": [
      "Core App Screens",
      "Native Integration",
      "Push Notification Setup",
      "App Store Submission",
      "Crash Reporting",
    ],
    "ai-genai": [
      "Model Integration",
      "Training Pipeline",
      "API Endpoint",
      "Response Optimization",
      "Monitoring Dashboard",
    ],
    automation: [
      "Workflow Design",
      "Trigger Configuration",
      "Error Handling",
      "Monitoring & Alerts",
      "Documentation",
    ],
    ecommerce: [
      "Product Catalog",
      "Cart & Checkout",
      "Payment Integration",
      "Order Management",
      "Inventory Tracking",
    ],
    "ui-ux": [
      "Research & Discovery",
      "Wireframes",
      "Visual Design",
      "Prototype",
      "Design System",
    ],
    "backend-api": [
      "Architecture Design",
      "API Endpoints",
      "Authentication",
      "Testing",
      "Documentation",
    ],
    devops: [
      "Infrastructure Setup",
      "Pipeline Configuration",
      "Monitoring Setup",
      "Security Hardening",
      "Documentation",
    ],
    cybersecurity: [
      "Vulnerability Scan",
      "Risk Assessment",
      "Remediation Plan",
      "Implementation",
      "Verification Report",
    ],
    "seo-marketing": [
      "Audit & Analysis",
      "Strategy Development",
      "Implementation",
      "Monitoring Setup",
      "Performance Report",
    ],
    "it-consulting": [
      "Discovery Session",
      "Analysis & Review",
      "Recommendations",
      "Implementation Guide",
      "Follow-up Session",
    ],
    saas: [
      "Core Feature Build",
      "Multi-tenant Setup",
      "Admin Panel",
      "API Layer",
      "Deployment & Docs",
    ],
    maintenance: [
      "Initial Assessment",
      "Priority Fixes",
      "Optimization",
      "Monitoring Setup",
      "SLA Documentation",
    ],
  };
  const features = templates[catId] ?? [
    "Setup",
    "Implementation",
    "Testing",
    "Documentation",
    "Deployment",
  ];
  return features.slice(0, count);
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
