import type { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "@stackfox/prisma";
import { isInternalRole, isReadOnlyClient } from "@stackfox/core";
import * as ids from "./id";

/**
 * Tenancy for the client portal.
 *
 * Every client-side user belongs to exactly one Org (individuals get a personal
 * one at registration). Client data hangs off that Org through a single chain:
 *
 *   User.orgId -> Org -> Engagement.clientId -> Project -> Milestone/File/Ticket
 *
 * Routes must never query these tables unfiltered. `clientScope()` returns the
 * caller's org id, or `null` for internal staff, who legitimately see across
 * tenants — so a handler reads:
 *
 *   const scope = await clientScope(req, reply);
 *   if (scope === undefined) return;           // reply already sent (401/403)
 *   where.engagement = scope ? { clientId: scope } : undefined;
 */

/** `undefined` means a response has already been sent and the handler must return. */
export type Scope = string | null | undefined;

export async function clientScope(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<Scope> {
  if (!req.user) {
    reply.code(401).send({ error: "Authentication required" });
    return undefined;
  }

  if (isInternalRole(req.user.role)) return null;

  const orgId = await resolveOrgId(req);
  if (!orgId) {
    // A client with no Org can see nothing; this should be unreachable because
    // registration provisions one, but failing closed beats leaking everything.
    reply.code(403).send({
      error: "No organisation is associated with this account.",
    });
    return undefined;
  }

  return orgId;
}

/**
 * Like `clientScope`, but also rejects read-only client roles. Use on every
 * mutating client route.
 */
export async function clientWriteScope(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<Scope> {
  const scope = await clientScope(req, reply);
  if (scope === undefined) return undefined;
  if (scope !== null && isReadOnlyClient(req.user!.role)) {
    reply.code(403).send({ error: "Your role has read-only access." });
    return undefined;
  }
  return scope;
}

/**
 * The JWT carries orgId, but tokens live 24h and an Org can be provisioned
 * after one is issued — so fall back to the database rather than forcing a
 * re-login.
 */
export async function resolveOrgId(req: FastifyRequest): Promise<string | null> {
  if (req.user?.orgId) return req.user.orgId;
  if (!req.user?.sub) return null;

  const user = await prisma.user.findUnique({
    where: { id: req.user.sub },
    select: { orgId: true },
  });
  if (user?.orgId) {
    req.user.orgId = user.orgId;
    return user.orgId;
  }
  return null;
}

/**
 * Provisions the personal Org an individual client is scoped by. Idempotent:
 * returns the existing org if the user already has one, or one already
 * registered against the same contact email.
 */
export async function ensurePersonalOrg(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error(`Cannot provision an org for unknown user ${userId}`);
  if (user.orgId) return user.orgId;

  const existing = await prisma.org.findFirst({ where: { contactEmail: user.email } });
  if (existing) {
    await prisma.user.update({ where: { id: userId }, data: { orgId: existing.id } });
    return existing.id;
  }

  const org = await prisma.org.create({
    data: {
      id: ids.orgId(),
      name: user.name || user.email.split("@")[0],
      type: "INDIVIDUAL",
      contactEmail: user.email,
      contactPhone: user.phone,
      status: "ACTIVE",
    },
  });

  await prisma.user.update({ where: { id: userId }, data: { orgId: org.id } });
  return org.id;
}

/**
 * Confirms a project belongs to the caller's tenant before it is read or
 * mutated. Returns false and sends 404 (not 403 — a client should not be able
 * to probe which project ids exist) when it does not.
 */
export async function assertProjectInScope(
  projectId: string,
  scope: string | null,
  reply: FastifyReply,
): Promise<boolean> {
  if (scope === null) return true; // internal staff

  const project = await prisma.project.findFirst({
    where: { id: projectId, engagement: { clientId: scope } },
    select: { id: true },
  });
  if (!project) {
    reply.code(404).send({ error: "Project not found" });
    return false;
  }
  return true;
}

/** Same contract as `assertProjectInScope`, for engagements. */
export async function assertEngagementInScope(
  engagementId: string,
  scope: string | null,
  reply: FastifyReply,
): Promise<boolean> {
  if (scope === null) return true;

  const eng = await prisma.engagement.findFirst({
    where: { id: engagementId, clientId: scope },
    select: { id: true },
  });
  if (!eng) {
    reply.code(404).send({ error: "Engagement not found" });
    return false;
  }
  return true;
}

/** Project ids visible to a scope — for filtering child tables in one query. */
export async function projectIdsInScope(scope: string | null): Promise<string[] | null> {
  if (scope === null) return null; // no restriction
  const projects = await prisma.project.findMany({
    where: { engagement: { clientId: scope } },
    select: { id: true },
  });
  return projects.map((p) => p.id);
}
