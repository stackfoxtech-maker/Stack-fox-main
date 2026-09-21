import type { FastifyInstance } from "fastify";
import { prisma } from "@stackfox/prisma";
import { z } from "zod";
import { isInternalRole } from "@stackfox/core";
import { requireAuth } from "../plugins/auth";
import { parseBody, strictObject } from "../lib/validate";
import { SCOPES, generateApiKey } from "../lib/apiKey";
import { LIST_CAP } from "../lib/http";

/**
 * Issuing and revoking API keys.
 *
 * The `ApiKey` model existed and nothing ever wrote to it, so re-enabling /v1
 * without this would have shipped an authenticated API that no customer could
 * obtain a credential for.
 *
 * These are first-party routes behind the normal JWT session, not /v1: you
 * cannot mint an API key with an API key, so a leaked key cannot be used to
 * issue itself a replacement or widen its own scope.
 */

/** Org owners and client admins manage their own org's keys. */
const ORG_MANAGER_ROLES = ["ORG_OWNER", "CLIENT_ADMIN"];

const CreateApiKeySchema = strictObject({
  /** Shown in the key list; not a secret. */
  label: z.string().trim().min(1).max(100).optional(),
  scopes: z.array(z.enum(SCOPES)).min(1).max(SCOPES.length).optional(),
});

/**
 * Everything except the hash. The hash is not a secret in the sense the key
 * is, but it is the verification material and there is no reason to serve it.
 */
const KEY_SELECT = {
  id: true,
  orgId: true,
  prefix: true,
  scopes: true,
  lastUsed: true,
  revokedAt: true,
  createdAt: true,
} as const;

export async function apiKeyRoutes(app: FastifyInstance) {
  /**
   * Resolves which org this caller may administer keys for, or null.
   *
   * Staff may pass `?orgId=` to act on a client's behalf, which is how support
   * issues a key for someone. A client-side manager is confined to their own
   * org and the parameter is ignored for them — accepting it would be the
   * same query-parameter tenancy bug /v1 just had.
   */
  function targetOrg(req: Parameters<typeof requireAuth>[0], queryOrgId?: string): string | null {
    const caller = req.user!;
    if (isInternalRole(caller.role)) return queryOrgId ?? caller.orgId ?? null;
    if (!caller.orgId) return null;
    return ORG_MANAGER_ROLES.includes(caller.role) ? caller.orgId : null;
  }

  app.get("/api-keys", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { orgId: queryOrgId } = req.query as { orgId?: string };

    const orgId = targetOrg(req, queryOrgId);
    if (!orgId) return reply.code(403).send({ error: "Insufficient permissions" });

    return prisma.apiKey.findMany({
      where: { orgId },
      select: KEY_SELECT,
      orderBy: { createdAt: "desc" },
      take: LIST_CAP,
    });
  });

  app.post("/api-keys", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { orgId: queryOrgId } = req.query as { orgId?: string };

    const orgId = targetOrg(req, queryOrgId);
    if (!orgId) return reply.code(403).send({ error: "Insufficient permissions" });

    const body = parseBody(req, reply, CreateApiKeySchema);
    if (!body) return;

    const { key, hash, prefix } = generateApiKey();

    const record = await prisma.apiKey.create({
      data: {
        orgId,
        prefix,
        keyHash: hash,
        // Read-only unless write is asked for explicitly: /v1 is a reporting
        // API, and the only mutation is webhook registration.
        scopes: body.scopes ?? ["read"],
      },
      select: KEY_SELECT,
    });

    req.log.info({ apiKeyId: record.id, orgId, scopes: record.scopes }, "API key issued");

    return reply.code(201).send({
      ...record,
      // The one and only time the plaintext exists outside the caller's hands.
      // Nothing stores it, so a lost key is reissued rather than recovered.
      key,
      warning: "Copy this key now — it is not stored and cannot be shown again.",
    });
  });

  app.delete("/api-keys/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { id } = req.params as { id: string };

    const orgId = targetOrg(req, undefined);
    const caller = req.user!;

    // Scoped by org in the filter, so another tenant's key id revokes nothing
    // rather than revoking theirs.
    const key = await prisma.apiKey.findFirst({
      where: { id, ...(isInternalRole(caller.role) ? {} : { orgId: orgId ?? "__none__" }) },
      select: { id: true, orgId: true, revokedAt: true },
    });
    if (!key) return reply.code(404).send({ error: "Not found" });
    if (!isInternalRole(caller.role) && !orgId) {
      return reply.code(403).send({ error: "Insufficient permissions" });
    }

    // Revoked, never deleted: the row is the record that the key existed, who
    // it belonged to and when it was last used. Deleting it would erase the
    // evidence trail at exactly the moment it matters.
    if (key.revokedAt) return { success: true, alreadyRevoked: true };

    await prisma.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });
    req.log.warn({ apiKeyId: id, orgId: key.orgId }, "API key revoked");

    return { success: true };
  });
}
