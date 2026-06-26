import "dotenv/config";

import { auth, env as authEnv } from "@azimuth/auth";
import { appRouter, createContext } from "@azimuth/api";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { toNodeHandler } from "better-auth/node";
import cors from "cors";
import express from "express";
import Redis from "ioredis";

import { env } from "./lib/env";

const app = express();

// Redis client for rate limiting (shared with @azimuth/api via the same REDIS_URL)
const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  lazyConnect: true,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
});
redis.on("error", (err) => console.warn("[redis] server:", err.message));

// Login rate limiter: 10 attempts per IP per 15 min window
async function loginRateLimitMiddleware(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  const ip =
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ??
    req.socket.remoteAddress ??
    "unknown";
  const key = `ratelimit:login:${ip}`;
  const LIMIT = 10;
  const WINDOW = 15 * 60; // 15 minutes

  try {
    const current = await redis.incr(key);
    if (current === 1) await redis.expire(key, WINDOW);
    const ttl = await redis.ttl(key);

    res.setHeader("X-RateLimit-Limit", LIMIT);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, LIMIT - current));
    res.setHeader("X-RateLimit-Reset", ttl);

    if (current > LIMIT) {
      res.status(429).json({
        error: "Too many login attempts. Try again later.",
        retryAfterSeconds: ttl,
      });
      return;
    }
  } catch {
    // Redis unavailable — fail open, don't block login
  }
  next();
}

app.use(
  cors({
    origin: [authEnv.ADMIN_APP_URL, authEnv.USER_APP_URL],
    credentials: true,
  }),
);

// Rate-limit sign-in endpoints before better-auth handles them
app.use("/api/auth/sign-in", loginRateLimitMiddleware);

// better-auth needs the raw request stream, so it must be mounted before express.json().
// Express 5 (path-to-regexp@8) requires named wildcards: "*splat", not bare "*".
app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(express.json());

app.use(
  "/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  }),
);

app.listen(env.PORT, () => {
  console.log(`server listening on http://localhost:${env.PORT}`);
});
