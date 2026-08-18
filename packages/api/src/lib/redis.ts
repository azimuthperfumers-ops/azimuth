// All Redis logic lives in @azimuth/redis — re-export so internal imports keep working
export {
  getRedis,
  cacheGet,
  cacheSet,
  cacheDel,
  cacheGetOrSet,
  cacheGetOrSetNs,
  cacheBumpVersion,
  CacheKey,
  CacheNs,
  CacheTtl,
  rateLimit,
} from "@azimuth/redis";
