import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import jwt from "jsonwebtoken";
import { redis } from "../lib/redis";
import { getSessionEpoch } from "../lib/session";
import {
  hasScope,
  touchApiKey,
  verifyApiKey,
  type ApiKeyIdentity,
  type ApiScope,
} from "../lib/apiKey";

function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "JWT_SECRET (or NEXTAUTH_SECRET) is required in production — refusing to sign or " +
        "verify tokens under the public dev-only fallback secret.",
    );
  }
  return "dev-secret-change-me";
}

const JWT_SECRET = resolveJwtSecret();

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  orgId?: string;
  /** Session epoch at issue time — see lib/session.ts. Absent on pre-upgrade tokens (treated as 0). */
  epoch?: number;
  /**
   * Which kind of token this is.
   *
   * Both kinds are signed with the same secret and carry the same payload, so
   * without this claim a 30-day refresh token presented as `Authorization:
   * Bearer` was accepted on every authenticated route — making the 24h access
   * lifetime decorative and the real exposure window for a stolen token thirty
   * days. Absent on tokens issued before this claim existed; those are treated
   * as access tokens so live sessions survive the deploy.
   */
  typ?: "access" | "refresh";
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign({ ...payload, typ: "access" }, JWT_SECRET, { expiresIn: "24h" });
}

export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign({ ...payload, typ: "refresh" }, JWT_SECRET, { expiresIn: "30d" });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

/**
 * Verifies a token and rejects it if it is explicitly the wrong kind, so a
 * refresh token cannot authenticate a request and an access token cannot renew
 * a session.
 *
 * Tokens minted before the `typ` claim existed carry no type and are accepted
 * by both callers — rejecting them would log out every live session on deploy.
 * That tolerance is safe on the refresh route because it additionally compares
 * the token against the one stored in Redis, which no access token matches.
 * Remove the tolerance once every pre-upgrade token has expired (30 days).
 */
export function verifyTokenOfType(
  token: string,
  expected: "access" | "refresh",
): JwtPayload {
  const payload = verifyToken(token);
  if (payload.typ && payload.typ !== expected) {
    throw new Error(`Expected a ${expected} token, got a ${payload.typ} token`);
  }
  return payload;
}

declare module "fastify" {
  interface FastifyRequest {
    user?: JwtPayload;
    /** Set by requireApiKey on /v1 requests. Never set on first-party routes. */
    apiKey?: ApiKeyIdentity;
  }
}

// Wrapped with fastify-plugin: without it, Fastify's default encapsulation
// scopes decorateRequest/addHook to this plugin's own context only, so
// req.user would never be set for routes registered as separate siblings
// (i.e. every other route file) and requireAuth() would 401 valid tokens.
export const authPlugin = fp(async function authPlugin(app: FastifyInstance) {
  app.decorateRequest("user", undefined);
  app.decorateRequest("apiKey", undefined);

  app.addHook("onRequest", async (req: FastifyRequest) => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      if (req.url.includes("/cart") || req.url.includes("/auth/me")) {
        req.log.warn(
          { url: req.url, hasAuth: !!header },
          "No Bearer token on protected route",
        );
      }
      return;
    }

    const token = header.slice(7);
    try {
      // Access tokens only. A refresh token here would otherwise authenticate
      // every route for its full 30-day life.
      const payload = verifyTokenOfType(token, "access");

      // Logout writes the access token to a Redis denylist. Without this check
      // that write did nothing and a logged-out token stayed valid for its full
      // 24h life. Redis being down must not silently re-open revoked sessions
      // for long, but it also must not lock everyone out — fail open and warn.
      try {
        if (await redis.get(`blacklist:${token}`)) {
          req.log.info({ url: req.url }, "Rejected a revoked token");
          return;
        }
      } catch (err: any) {
        req.log.warn(
          { err: err.message },
          "Token denylist unavailable; falling back to session epoch",
        );
      }

      // Session-epoch check. Unlike the Redis denylist this is backed by the
      // user row, so logout / password reset still revoke tokens when Redis is
      // down. getSessionEpoch is Redis-cached, DB-authoritative.
      try {
        const currentEpoch = await getSessionEpoch(payload.sub);
        if ((payload.epoch ?? 0) < currentEpoch) {
          req.log.info({ url: req.url }, "Rejected a token from a revoked session");
          return;
        }
      } catch (err: any) {
        // Revocation/account state cannot be established: reject the token.
        req.log.warn({ err: err.message }, "Session-epoch check failed; rejecting token");
        return;
      }

      req.user = payload;
    } catch (err: any) {
      req.log.warn({ url: req.url, error: err.message }, "Token verification failed");
    }
  });
});

export function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  if (!req.user) {
    reply.code(401).send({ error: "Authentication required" });
    return false;
  }
  return true;
}

export function requireRole(
  req: FastifyRequest,
  reply: FastifyReply,
  roles: readonly string[],
) {
  if (!requireAuth(req, reply)) return false;
  if (!roles.includes(req.user!.role)) {
    reply.code(403).send({ error: "Insufficient permissions" });
    return false;
  }
  return true;
}

/**
 * Resolves the presented `x-api-key` and attaches the org it belongs to.
 *
 * The previous implementation checked the header was non-empty and returned
 * true, which is why /v1 was unregistered in Phase 0 rather than shipped. It
 * is async now because it has to hit the database — there is no way to
 * authenticate a key without looking it up.
 *
 * The client is told "Invalid API key" whatever the reason. Distinguishing
 * unknown from revoked would confirm to an attacker that a key they hold was
 * real, so the detail goes to the log and not to the response.
 */
export async function requireApiKey(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<boolean> {
  const result = await verifyApiKey(req.headers["x-api-key"]);

  if (!result.ok) {
    req.log.warn({ reason: result.reason }, "API key rejected");
    await reply.code(401).send({ error: "Invalid API key", requestId: String(req.id) });
    return false;
  }

  req.apiKey = result.identity;
  touchApiKey(result.identity.id);
  return true;
}

/**
 * Guards a write. /v1 is read-only apart from webhook registration, so a
 * read-scoped key reaching a mutation is the case this catches.
 */
export async function requireApiScope(
  req: FastifyRequest,
  reply: FastifyReply,
  scope: ApiScope,
): Promise<boolean> {
  if (!req.apiKey) {
    await reply.code(401).send({ error: "Invalid API key", requestId: String(req.id) });
    return false;
  }
  if (!hasScope(req.apiKey, scope)) {
    await reply.code(403).send({
      error: `This API key does not have the "${scope}" scope`,
      requestId: String(req.id),
    });
    return false;
  }
  return true;
}
