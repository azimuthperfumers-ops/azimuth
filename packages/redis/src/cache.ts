import { getRedis } from "./client";

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
      // corrupt entry — re-fetch
    }
  }
  const value = await fallback();
  await cacheSet(key, JSON.stringify(value), ttlSeconds);
  return value;
}

export const CacheKey = {
  categoryProductCount: (categoryId: string) => `cat:count:${categoryId}`,
  allCategoryCounts: () => "cat:count:*",
} as const;
