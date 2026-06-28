import Redis from "ioredis";

let _client: Redis | null = null;

function makeRedisOptions(url: string) {
  const parsed = new URL(url);
  const isTls = parsed.protocol === "rediss:";
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || (isTls ? "6380" : "6379"), 10),
    username: parsed.username || undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    tls: isTls ? {} : undefined,
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    reconnectOnError: () => true,
    keepAlive: 20000,
  };
}

export function getRedis(): Redis {
  if (!_client) {
    const url = process.env.REDIS_URL ?? "redis://localhost:6379";
    _client = new Redis(makeRedisOptions(url));
    _client.on("error", (err) => console.warn("[redis]", err.message));
  }
  return _client;
}
