import { getRedis } from "./client";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
}

export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  try {
    const redis = getRedis();
    const current = await redis.incr(key);
    if (current === 1) await redis.expire(key, windowSeconds);
    const ttl = await redis.ttl(key);
    return {
      allowed: current <= limit,
      remaining: Math.max(0, limit - current),
      resetInSeconds: ttl < 0 ? windowSeconds : ttl,
    };
  } catch {
    // Redis down — fail open
    return { allowed: true, remaining: limit, resetInSeconds: windowSeconds };
  }
}
