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
  // Logistics — provider selector
  LOGISTICS_PROVIDER: z.string().default("delhivery"),
  // Logistics — Delhivery Express B2C
  DELHIVERY_TOKEN: z.string().optional(),
  DELHIVERY_BASE_URL: z.string().optional(), // default: https://staging-express.delhivery.com
  DELHIVERY_PICKUP_NAME: z.string().optional(),
  DELHIVERY_CLIENT: z.string().optional(),   // e.g. AZIMUTHSURFACE-B2C
  DELHIVERY_WAREHOUSE_PINCODE: z.string().optional(),
  DELHIVERY_WAREHOUSE_PHONE: z.string().optional(),
  DELHIVERY_WAREHOUSE_CITY: z.string().optional(),
  DELHIVERY_WAREHOUSE_STATE: z.string().optional(),
  DELHIVERY_WAREHOUSE_ADDRESS: z.string().optional(),
  DELHIVERY_WAREHOUSE_NAME: z.string().optional(),
  DELHIVERY_RATE_FALLBACK_INR: z.coerce.number().optional(), // staging only: used when rate API returns 0
  // Logistics — Shiprocket (kept for reference / future swap back)
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
