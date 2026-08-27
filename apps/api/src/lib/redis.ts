import Redis from "ioredis";

export const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
  enableOfflineQueue: true,
  retryStrategy(times) {
    if (times > 10) return null;
    return Math.min(times * 500, 5000);
  },
  lazyConnect: true,
});

/**
 * Redis is not optional in practice: OTP, password reset, token revocation and
 * every BullMQ worker depend on it. A hosted Redis (Upstash et al.) requires
 * TLS, so a `redis://` URL where `rediss://` is needed connects and then closes
 * — which used to surface as one muted warning at boot and silent no-ops
 * thereafter. Say so loudly, and point at the likely cause.
 */
export let redisReady = false;

redis.on("ready", () => {
  redisReady = true;
});
redis.on("end", () => {
  redisReady = false;
});

redis.connect().catch((err) => {
  redisReady = false;
  const url = process.env.REDIS_URL ?? "";
  const hint =
    url.startsWith("redis://") && !url.includes("localhost") && !url.includes("127.0.0.1")
      ? " Hosted Redis usually requires TLS — try the rediss:// scheme."
      : "";
  console.error(
    `[redis] Connection failed: ${err.message}.${hint} ` +
      "OTP, password reset, token revocation and all background workers are degraded.",
  );
});

export const cache = {
  async get<T>(key: string): Promise<T | null> {
    const val = await redis.get(key);
    return val ? JSON.parse(val) : null;
  },
  async set(key: string, value: unknown, ttlSec = 300): Promise<void> {
    await redis.set(key, JSON.stringify(value), "EX", ttlSec);
  },
  async del(key: string): Promise<void> {
    await redis.del(key);
  },
  async lock(key: string, ttlMs = 10000): Promise<boolean> {
    const result = await redis.set(`lock:${key}`, "1", "PX", ttlMs, "NX");
    return result === "OK";
  },
  async unlock(key: string): Promise<void> {
    await redis.del(`lock:${key}`);
  },
};
