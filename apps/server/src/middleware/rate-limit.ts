import type { NextFunction, Request, Response } from "express";

import { rateLimit } from "@azimuth/redis";

const LIMIT = 10;
const WINDOW = 15 * 60; // 15 minutes

export async function loginRateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const ip =
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ??
    req.socket.remoteAddress ??
    "unknown";

  const { allowed, remaining, resetInSeconds } = await rateLimit(
    `ratelimit:login:${ip}`,
    LIMIT,
    WINDOW,
  );

  res.setHeader("X-RateLimit-Limit", LIMIT);
  res.setHeader("X-RateLimit-Remaining", remaining);
  res.setHeader("X-RateLimit-Reset", resetInSeconds);

  if (!allowed) {
    res.status(429).json({
      error: "Too many login attempts. Try again later.",
      retryAfterSeconds: resetInSeconds,
    });
    return;
  }
  next();
}
