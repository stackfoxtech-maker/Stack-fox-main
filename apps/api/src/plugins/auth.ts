import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import jwt from "jsonwebtoken";
import { redis } from "../lib/redis";

const JWT_SECRET = process.env.JWT_SECRET ?? process.env.NEXTAUTH_SECRET ?? "dev-secret-change-me";

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  orgId?: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "24h" });
}

export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

declare module "fastify" {
  interface FastifyRequest {
    user?: JwtPayload;
  }
}

// Wrapped with fastify-plugin: without it, Fastify's default encapsulation
// scopes decorateRequest/addHook to this plugin's own context only, so
// req.user would never be set for routes registered as separate siblings
// (i.e. every other route file) and requireAuth() would 401 valid tokens.
export const authPlugin = fp(async function authPlugin(app: FastifyInstance) {
  app.decorateRequest("user", undefined);

  app.addHook("onRequest", async (req: FastifyRequest) => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      if (req.url.includes("/cart") || req.url.includes("/auth/me")) {
        req.log.warn({ url: req.url, hasAuth: !!header }, "No Bearer token on protected route");
      }
      return;
    }

    const token = header.slice(7);
    try {
      const payload = verifyToken(token);

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
        req.log.warn({ err: err.message }, "Token denylist unavailable; accepting token");
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

export function requireRole(req: FastifyRequest, reply: FastifyReply, roles: string[]) {
  if (!requireAuth(req, reply)) return false;
  if (!roles.includes(req.user!.role)) {
    reply.code(403).send({ error: "Insufficient permissions" });
    return false;
  }
  return true;
}

export function requireApiKey(req: FastifyRequest, reply: FastifyReply) {
  const key = req.headers["x-api-key"] as string;
  if (!key) {
    reply.code(401).send({ error: "API key required" });
    return false;
  }
  return true;
}
