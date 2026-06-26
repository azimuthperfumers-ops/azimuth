import { auth } from "@azimuth/auth";
import { db } from "@azimuth/db";
import { fromNodeHeaders } from "better-auth/node";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";

import { getRedis } from "./lib/redis";

export async function createContext({ req }: CreateExpressContextOptions) {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  return { db, session, redis: getRedis() };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
