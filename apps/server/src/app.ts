import { auth, env as authEnv } from "@azimuth/auth";
import { appRouter, createContext } from "@azimuth/api";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { toNodeHandler } from "better-auth/node";
import cors from "cors";
import express from "express";

import { loginRateLimitMiddleware } from "./middleware/rate-limit";
import { delhiveryWebhookHandler } from "./webhooks/delhivery";
import { delhiveryPodWebhookHandler } from "./webhooks/delhivery-pod";
import { razorpayWebhookHandler } from "./webhooks/razorpay";

export const app = express();

app.use(
  cors({
    origin: [authEnv.ADMIN_APP_URL, authEnv.USER_APP_URL],
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

// Delhivery Scan Push — shipment status updates
app.post("/webhooks/delhivery", delhiveryWebhookHandler);
// Delhivery POD (Document Push) — proof of delivery image
app.post("/webhooks/delhivery-pod", delhiveryPodWebhookHandler);

app.use(
  "/trpc",
  createExpressMiddleware({ router: appRouter, createContext }),
);
