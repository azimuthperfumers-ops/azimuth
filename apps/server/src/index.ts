import "dotenv/config";

import { assertCriticalEnv } from "@azimuth/api";

// Payment + logistics envs must be complete before we accept a single request —
// a misconfigured server must fail deploy, not quietly mis-serve checkout.
assertCriticalEnv({ requireWebhookSecrets: true });

import { app } from "./app";
import { env } from "./lib/env";

app.get("/health", (_req, res) => res.json({ health: "ok" }));

app.listen(env.PORT, () => {
  console.log(`server listening on http://localhost:${env.PORT}`);
});
