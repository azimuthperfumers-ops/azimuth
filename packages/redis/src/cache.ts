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

// ─── Namespace versioning ────────────────────────────────────────────────────
// Catalog keys are parameterised (a product list differs per filter combination),
// so a write can't delete them by name without SCANning the keyspace. Instead
// every key embeds its namespace's current version, and a write bumps that
// version — the old keys are orphaned instantly and expire on their own TTL.
// One INCR invalidates an entire family of keys.

const versionKey = (ns: string) => `ver:${ns}`;

/** Current version of a namespace. Missing key reads as "0" so the first bump lands on 1. */
export async function cacheVersion(ns: string): Promise<string> {
  return (await cacheGet(versionKey(ns))) ?? "0";
}

/** Invalidate every key in a namespace. Cheap: a single INCR. */
export async function cacheBumpVersion(ns: string): Promise<void> {
  try {
    await getRedis().incr(versionKey(ns));
  } catch {
    // silently degrade — a failed bump means Redis is down, in which case
    // cacheGetOrSet is already falling through to the database anyway.
  }
}

/** cacheGetOrSet against a versioned namespace. */
export async function cacheGetOrSetNs<T>(
  ns: string,
  key: string,
  ttlSeconds: number,
  fallback: () => Promise<T>,
): Promise<T> {
  const version = await cacheVersion(ns);
  return cacheGetOrSet(`${ns}:v${version}:${key}`, ttlSeconds, fallback);
}

export const CacheNs = {
  /** Products, variants, images, categories, notes, discounts — anything shown on the storefront. */
  catalog: "catalog",
} as const;

export const CacheKey = {
  categoryProductCount: (categoryId: string) => `cat:count:${categoryId}`,
  allCategoryCounts: () => "cat:count:*",
  siteSettings: () => "settings:site",
  contentSection: (section: string) => `content:section:${section}`,
  banners: (page: string) => `content:banners:${page}`,
} as const;

// TTLs are chosen against Neon's scale-to-zero window (5 minutes of no queries
// suspends the compute). Anything shorter than that keeps the database awake
// around the clock, which is what exhausted the compute allowance on 2026-08-18.
export const CacheTtl = {
  /** Catalog reads — prices move on discount schedules, stock on orders. */
  catalog: 600,
  /** Settings, CMS copy, banners — only change when an admin edits them, which bumps/deletes the key. */
  content: 1800,
} as const;
