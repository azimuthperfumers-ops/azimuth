import "dotenv/config";

import { assertCriticalEnv } from "@azimuth/api";

// Payment + logistics envs must be complete before we accept a single request —
// a misconfigured server must fail deploy, not quietly mis-serve checkout.
assertCriticalEnv({ requireWebhookSecrets: true });

import { ensureRedis } from "@azimuth/redis";

import { app } from "./app";
import { env } from "./lib/env";

// Redis is reported, not gated: the queue and cache degrade gracefully, so a
// redis outage must not read as "API down" to the uptime monitor — but it has to
// be visible somewhere, or a dead redis stays invisible until checkout breaks.
app.get("/health", async (_req, res) => {
  let redis: "ok" | "down" = "down";
  try {
    const client = await ensureRedis();
    if (await client.ping()) redis = "ok";
  } catch {
    redis = "down";
  }
  res.json({ health: "ok", redis });
});

app.listen(env.PORT, () => {
  console.log(`server listening on http://localhost:${env.PORT}`);
});
