import { z } from "zod";

const schema = z.object({
  // Cloudflare R2
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_PUBLIC_URL: z.string().optional(),
  // Razorpay
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  // Logistics — provider selector: "shiprocket" | "stub"
  LOGISTICS_PROVIDER: z.string().default("shiprocket"),
  // Logistics — Shiprocket
  SHIPROCKET_EMAIL: z.string().optional(),
  SHIPROCKET_PASSWORD: z.string().optional(),
  SHIPROCKET_PICKUP_LOCATION: z.string().optional(),
  SHIPROCKET_CHANNEL_ID: z.coerce.number().optional(),
  SHIPROCKET_WAREHOUSE_PINCODE: z.string().optional(),
  SHIPROCKET_WAREHOUSE_PHONE: z.string().optional(),
  SHIPROCKET_WAREHOUSE_CITY: z.string().optional(),
  SHIPROCKET_WAREHOUSE_STATE: z.string().optional(),
  SHIPROCKET_WAREHOUSE_ADDRESS: z.string().optional(),
  SHIPROCKET_LOCATION_ID: z.string().optional(),
  // Optional egress relay (deploy/shiprocket-relay) for when Shiprocket blocks
  // the server's IP. Unset = call apiv2.shiprocket.in directly.
  SHIPROCKET_BASE_URL: z.string().url().optional(),
  SHIPROCKET_RELAY_KEY: z.string().optional(),
});

export const env = schema.parse(process.env);
