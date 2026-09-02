import type { FastifyInstance } from "fastify";
import { prisma } from "@stackfox/prisma";
import { requireRole } from "../plugins/auth";
import { ok } from "../lib/http";
import { isStorageConfigured } from "../lib/storage";
import { isCredentialEncryptionConfigured } from "../lib/crypto";
import { redis } from "../lib/redis";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN", "SE", "SENIOR_PM"];

/**
 * Environment and feature-flag settings for the admin dashboard.
 *
 * `featureFlags` used to be three hard-coded booleans that no admin action
 * could change and nothing read. They now come from the `Flag` table, which is
 * what `/admin/flags` already writes to, so the settings screen reflects the
 * real state of the system.
 */
export async function settingsRoutes(app: FastifyInstance) {
  app.get("/settings", async (req, reply) => {
    if (!requireRole(req, reply, ADMIN_ROLES)) return;

    const [flags, redisUp] = await Promise.all([
      prisma.flag.findMany({ orderBy: { id: "asc" } }).catch(() => []),
      redis.ping().then(() => true).catch(() => false),
    ]);

    return ok({
      environment: process.env.NODE_ENV ?? "development",
      integrations: {
        // Storage moved to Supabase; the old R2 keys are gone, so checking for
        // them reported "not configured" on a perfectly working install.
        storage: { configured: isStorageConfigured(), provider: "supabase" },
        database: { configured: Boolean(process.env.DATABASE_URL) },
        redis: { configured: Boolean(process.env.REDIS_URL), reachable: redisUp },
        razorpay: { configured: Boolean(process.env.RAZORPAY_KEY_ID?.trim()) },
        stripe: { configured: Boolean(process.env.STRIPE_SECRET_KEY?.trim()) },
        gemini: { configured: Boolean(process.env.GEMINI_API_KEY?.trim()) },
        email: { configured: Boolean(process.env.RESEND_API_KEY ?? process.env.SMTP_HOST) },
        sms: { configured: Boolean(process.env.MSG91_AUTH_KEY ?? process.env.WHATSAPP_BSP_URL) },
        credentialVault: { configured: isCredentialEncryptionConfigured() },
      },
      featureFlags: flags.map((f) => ({
        id: f.id,
        type: f.type,
        enabled: f.defaultValue,
        description: f.description,
        rules: f.rules,
        updatedAt: f.updatedAt,
      })),
    });
  });
}
