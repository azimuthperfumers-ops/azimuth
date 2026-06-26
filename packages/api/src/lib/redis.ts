import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

let _client: Redis | null = null;

export function getRedis(): Redis {
  if (!_client) {
    _client = new Redis(REDIS_URL, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
    });
    _client.on("error", (err) => {
      // Don't crash server if Redis is unavailable — degrade gracefully
      console.warn("[redis] connection error:", err.message);
    });
  }
  return _client;
}

// ─── Cache helpers ────────────────────────────────────────────────────────────

export async function cacheGet(key: string): Promise<string | null> {
  try {
    return await getRedis().get(key);
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  try {
    await getRedis().setex(key, ttlSeconds, value);
  } catch {
    // silently degrade
  }
}

export async function cacheDel(...keys: string[]): Promise<void> {
  try {
    if (keys.length > 0) await getRedis().del(...keys);
  } catch {
    // silently degrade
  }
}

export async function cacheGetOrSet<T>(
  key: string,
  ttlSeconds: number,
  fallback: () => Promise<T>,
): Promise<T> {
  const cached = await cacheGet(key);
  if (cached !== null) {
    try {
      return JSON.parse(cached) as T;
    } catch {
      // corrupt cache entry — re-fetch
    }
  }
  const value = await fallback();
  await cacheSet(key, JSON.stringify(value), ttlSeconds);
  return value;
}

// ─── Rate limit helper ────────────────────────────────────────────────────────

/**
 * Sliding-window counter rate limiter.
 * Returns { allowed, remaining, resetInSeconds }.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; remaining: number; resetInSeconds: number }> {
  try {
    const redis = getRedis();
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, windowSeconds);
    }
    const ttl = await redis.ttl(key);
    const remaining = Math.max(0, limit - current);
    return {
      allowed: current <= limit,
      remaining,
      resetInSeconds: ttl < 0 ? windowSeconds : ttl,
    };
  } catch {
    // Redis down → allow (fail open)
    return { allowed: true, remaining: limit, resetInSeconds: windowSeconds };
  }
}

// ─── Cache key constants ──────────────────────────────────────────────────────

export const CacheKey = {
  categoryProductCount: (categoryId: string) => `cat:count:${categoryId}`,
  allCategoryCounts: () => "cat:count:*",
} as const;
