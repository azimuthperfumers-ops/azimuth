import { auth } from "@azimuth/auth";
import { db } from "@azimuth/db";
import { fromNodeHeaders } from "better-auth/node";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";

import { getRedis } from "./lib/redis";

export async function createContext({ req }: CreateExpressContextOptions) {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  // Client IP for rate-limiting. Behind Caddy the real IP is in x-forwarded-for;
  // fall back to the socket address. Used to throttle brute force on the owner code.
  const forwarded = req.headers["x-forwarded-for"];
  const ip =
    (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown";

  return { db, session, redis: getRedis(), ip };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
