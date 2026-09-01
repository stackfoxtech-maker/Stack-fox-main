import { prisma } from "@stackfox/prisma";
import { redis } from "./redis";
import { toJson } from "./json";

/**
 * Session revocation via a per-user "epoch".
 *
 * The old scheme was a Redis-only access-token denylist. When Redis was
 * unreachable the auth hook failed open — so logout, password reset and account
 * disable silently stopped revoking anything, and a stolen token stayed valid
 * for its full 24h. (The access-control suite caught exactly this: "token
 * rejected after logout -> 200".)
 *
 * Now every issued access token carries the user's current epoch. Bumping the
 * epoch (logout, password change, forced logout) invalidates every token minted
 * before the bump. The source of truth is a column on the user row
 * (`auth_data.sessionEpoch`), so it survives a total Redis outage; Redis is
 * only a read-through cache in front of it.
 */

const CACHE_TTL_SEC = 300;
const cacheKey = (userId: string) => `sessepoch:${userId}`;

function epochFromAuthData(authData: unknown): number {
  const raw = (authData as Record<string, unknown> | null)?.sessionEpoch;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** Current epoch for a user. Redis-cached; falls back to the DB row on any cache miss or Redis outage. */
export async function getSessionEpoch(userId: string): Promise<number> {
  try {
    const cached = await redis.get(cacheKey(userId));
    if (cached !== null) return Number(cached) || 0;
  } catch {
    /* Redis down — fall through to the DB, which is authoritative anyway. */
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { authData: true },
  });
  const epoch = user ? epochFromAuthData(user.authData) : 0;

  try {
    await redis.set(cacheKey(userId), String(epoch), "EX", CACHE_TTL_SEC);
  } catch {
    /* best-effort cache warm */
  }
  return epoch;
}

/**
 * Invalidates every access token issued to this user so far. Call on logout,
 * password reset, and account disable.
 */
export async function bumpSessionEpoch(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { authData: true },
  });
  if (!user) return 0;

  const authData = (user.authData as Record<string, unknown> | null) ?? {};
  const next = epochFromAuthData(authData) + 1;

  await prisma.user.update({
    where: { id: userId },
    data: { authData: toJson({ ...authData, sessionEpoch: next }) },
  });

  // Keep the refresh token in lockstep and refresh the cache immediately so the
  // bump takes effect on the very next request even while the old value is
  // still within its TTL.
  try {
    await Promise.all([
      redis.set(cacheKey(userId), String(next), "EX", CACHE_TTL_SEC),
      redis.del(`refresh:${userId}`),
    ]);
  } catch {
    /* DB write already succeeded — the cache will catch up when its TTL lapses. */
  }
  return next;
}
