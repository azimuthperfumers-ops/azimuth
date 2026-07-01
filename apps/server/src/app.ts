import { auth, env as authEnv } from "@azimuth/auth";
import { appRouter, createContext } from "@azimuth/api";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { toNodeHandler } from "better-auth/node";
import cors from "cors";
import express from "express";

import { loginRateLimitMiddleware } from "./middleware/rate-limit";
import { razorpayWebhookHandler, shiprocketWebhookHandler, delhiveryWebhookHandler } from "@azimuth/webhooks";

export const app = express();

const allowedOrigins = new Set(
  [
    authEnv.ADMIN_APP_URL,
    authEnv.USER_APP_URL,
    // Comma-separated extra origins for local dev overrides (e.g. CORS_EXTRA_ORIGINS=http://localhost:3002)
    ...(process.env.CORS_EXTRA_ORIGINS?.split(",") ?? []),
  ].map((o) => o.trim().replace(/\/$/, "").toLowerCase()),
);

console.log("[cors] allowed origins:", [...allowedOrigins]);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin.replace(/\/$/, "").toLowerCase())) {
        callback(null, true);
      } else {
        console.warn(`[cors] blocked: ${origin}`);
        callback(null, false);
      }
    },
    credentials: true,
  }),
);

// Rate-limit sign-in before better-auth handles it
app.use("/api/auth/sign-in", loginRateLimitMiddleware);

// better-auth needs raw stream — mount before express.json()
// Express 5 requires named wildcards: "*splat" not bare "*"
app.all("/api/auth/*splat", toNodeHandler(auth));

// Razorpay webhook needs raw body for HMAC verification — mount before express.json()
app.post("/webhooks/razorpay", express.raw({ type: "application/json" }), razorpayWebhookHandler);

app.use(express.json());

// Logistics tracking events — Shiprocket (kept for historical orders)
app.post("/webhooks/tracking", shiprocketWebhookHandler);

// Delhivery scan-push webhook — auth via ?token=<DELHIVERY_WEBHOOK_TOKEN>
app.post("/webhooks/delhivery", delhiveryWebhookHandler);

app.use(
  "/trpc",
  createExpressMiddleware({ router: appRouter, createContext }),
);
