import Redis from "ioredis";

/**
 * Rate limiter (docs/04 phase-6 hardening). Redis-backed (fixed window via
 * INCR+PEXPIRE — two round trips, correct across multiple instances/regions)
 * when REDIS_URL is set; falls back to the original single-instance
 * in-memory sliding window otherwise, and if Redis itself errors at runtime.
 * Fixed-window is slightly more permissive right at window boundaries than a
 * true sliding window, which is the standard, well-understood tradeoff for
 * the extra round trip a sorted-set sliding window would cost.
 */

let redisClient: Redis | null | undefined;
function getRedis(): Redis | null {
  if (redisClient !== undefined) return redisClient;
  if (!process.env.REDIS_URL) {
    redisClient = null;
    return null;
  }
  redisClient = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    lazyConnect: false,
  });
  redisClient.on("error", (err) => {
    console.error("[rate-limit] redis connection error", err);
  });
  return redisClient;
}

const buckets = new Map<string, number[]>();

function inMemoryRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;
  const hits = (buckets.get(key) ?? []).filter((t) => t > cutoff);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  // Opportunistic cleanup so the map doesn't grow unbounded.
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) {
      if (v.every((t) => t <= cutoff)) buckets.delete(k);
    }
  }
  return true;
}

export async function rateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const client = getRedis();
  if (!client) return inMemoryRateLimit(key, limit, windowMs);
  try {
    const redisKey = `ratelimit:${key}`;
    const count = await client.incr(redisKey);
    if (count === 1) await client.pexpire(redisKey, windowMs);
    return count <= limit;
  } catch (err) {
    console.error("[rate-limit] redis error, falling back to in-memory", err);
    return inMemoryRateLimit(key, limit, windowMs);
  }
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0]!.trim() : "unknown";
}
