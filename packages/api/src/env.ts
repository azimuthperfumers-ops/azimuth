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
  // Logistics — Shiprocket
  LOGISTICS_PROVIDER: z.string().default("shiprocket"),
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
  // Worker service
  WORKER_URL: z.string().optional(),
});

export const env = schema.parse(process.env);
