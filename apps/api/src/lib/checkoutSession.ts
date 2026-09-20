import { prisma } from "@stackfox/prisma";
import { redis } from "./redis";
import { toJson } from "./json";

/**
 * Checkout session storage.
 *
 * Postgres is the source of truth; Redis is a read cache in front of it. The
 * session used to live only in Redis, so a restart, failover or eviction
 * mid-checkout returned "Session expired" and the customer started over —
 * possibly after the gateway had already charged them.
 *
 * Losing Redis now costs a database round trip, not a purchase.
 */

const TTL_SEC = 3600;
const key = (sid: string) => `checkout:${sid}`;

export interface CheckoutSession {
  estimateId: string;
  tier: string;
  step: number;
  accountDetails?: Record<string, unknown>;
  engagementDetails?: Record<string, unknown>;
  paymentTerms?: Record<string, unknown>;
  clauseSelections?: Record<string, unknown>;
  signed?: boolean;
  razorpayOrderId?: string;
  /** Set once /complete has provisioned. Present means "do not run again". */
  consumedAt?: string;
  resultOrderId?: string;
}

function fromRow(row: {
  estimateId: string;
  tier: string;
  step: number;
  data: unknown;
  razorpayOrderId: string | null;
  consumedAt: Date | null;
  resultOrderId: string | null;
}): CheckoutSession {
  return {
    ...((row.data as Record<string, unknown>) ?? {}),
    estimateId: row.estimateId,
    tier: row.tier,
    step: row.step,
    razorpayOrderId: row.razorpayOrderId ?? undefined,
    consumedAt: row.consumedAt?.toISOString(),
    resultOrderId: row.resultOrderId ?? undefined,
  };
}

/** The fields the row owns as columns; everything else goes into `data`. */
function splitForRow(s: CheckoutSession) {
  const { estimateId, tier, step, razorpayOrderId, consumedAt, resultOrderId, ...rest } = s;
  return { estimateId, tier, step, razorpayOrderId, data: rest };
}

export async function createSession(
  sid: string,
  session: CheckoutSession,
  userId?: string,
): Promise<void> {
  const { estimateId, tier, step, data } = splitForRow(session);
  await prisma.checkoutSession.create({
    data: {
      id: sid,
      estimateId,
      userId,
      tier,
      step,
      data: toJson(data),
      expiresAt: new Date(Date.now() + TTL_SEC * 1000),
    },
  });
  await cacheWrite(sid, session);
}

/** Cache miss or a Redis outage falls through to the row, which is authoritative. */
export async function readSession(sid: string): Promise<CheckoutSession | null> {
  try {
    const cached = await redis.get(key(sid));
    if (cached) return JSON.parse(cached) as CheckoutSession;
  } catch {
    /* Redis down — the database still has it. */
  }

  const row = await prisma.checkoutSession.findUnique({ where: { id: sid } });
  if (!row) return null;
  if (row.expiresAt < new Date()) return null;

  const session = fromRow(row);
  await cacheWrite(sid, session);
  return session;
}

export async function writeSession(sid: string, session: CheckoutSession): Promise<void> {
  const { estimateId, tier, step, razorpayOrderId, data } = splitForRow(session);
  await prisma.checkoutSession.update({
    where: { id: sid },
    data: {
      estimateId,
      tier,
      step,
      razorpayOrderId,
      data: toJson(data),
      expiresAt: new Date(Date.now() + TTL_SEC * 1000),
    },
  });
  await cacheWrite(sid, session);
}

async function cacheWrite(sid: string, session: CheckoutSession): Promise<void> {
  try {
    await redis.set(key(sid), JSON.stringify(session), "EX", TTL_SEC);
  } catch {
    /* Best-effort; the row is what matters. */
  }
}

/** Drops the cached copy so the next read reflects a row changed elsewhere. */
export async function invalidateSession(sid: string): Promise<void> {
  try {
    await redis.del(key(sid));
  } catch {
    /* ignore */
  }
}
