import "dotenv/config";

import { auth, env as authEnv } from "@azimuth/auth";
import { appRouter, createContext } from "@azimuth/api";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { toNodeHandler } from "better-auth/node";
import cors from "cors";
import express from "express";

import { env } from "./lib/env";

const app = express();

app.use(
  cors({
    origin: [authEnv.ADMIN_APP_URL, authEnv.USER_APP_URL],
    credentials: true,
  }),
);

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
