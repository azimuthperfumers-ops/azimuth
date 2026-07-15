// Boot-time guard: payment and logistics processing must never start half-configured.
// Called from apps/server and apps/worker before they begin listening/processing —
// a missing critical env fails the process at startup instead of failing an order later.

import { env } from "../env";

const RAZORPAY_REQUIRED = ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"] as const;

// Everything the Shiprocket provider needs for forward shipments (refund-only
// policy — no reverse pickups). Warehouse pincode drives serviceability/rates.
const SHIPROCKET_REQUIRED = [
  "SHIPROCKET_EMAIL",
  "SHIPROCKET_PASSWORD",
  "SHIPROCKET_PICKUP_LOCATION",
  "SHIPROCKET_WAREHOUSE_PINCODE",
  "SHIPROCKET_WAREHOUSE_PHONE",
  "SHIPROCKET_WAREHOUSE_CITY",
  "SHIPROCKET_WAREHOUSE_STATE",
  "SHIPROCKET_WAREHOUSE_ADDRESS",
] as const;

export function assertCriticalEnv(opts: { requireWebhookSecrets?: boolean } = {}) {
  const missing: string[] = [];

  for (const key of RAZORPAY_REQUIRED) {
    if (!env[key]) missing.push(key);
  }

  if (env.LOGISTICS_PROVIDER !== "shiprocket") {
    missing.push(`LOGISTICS_PROVIDER (is "${env.LOGISTICS_PROVIDER}", must be "shiprocket")`);
  }
  for (const key of SHIPROCKET_REQUIRED) {
    if (!env[key]) missing.push(key);
  }

  // Webhook secrets only matter where webhooks terminate (the server app)
  if (opts.requireWebhookSecrets) {
    if (!env.RAZORPAY_WEBHOOK_SECRET) missing.push("RAZORPAY_WEBHOOK_SECRET");
    if (!process.env.SHIPROCKET_WEBHOOK_SECRET) missing.push("SHIPROCKET_WEBHOOK_SECRET");
  }

  if (missing.length > 0) {
    throw new Error(
      `Critical env vars missing — refusing to start:\n  - ${missing.join("\n  - ")}`,
    );
  }
}
