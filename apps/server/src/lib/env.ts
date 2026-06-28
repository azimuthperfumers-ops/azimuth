import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  REDIS_URL: z.string().default("redis://localhost:6379"),
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
  SHIPROCKET_WEBHOOK_SECRET: z.string().optional(),
  // MSG91 comms
  MSG91_AUTH_KEY: z.string().optional(),
  MSG91_SENDER_ID: z.string().default("AZIMUT"),
  MSG91_EMAIL_DOMAIN: z.string().optional(),
  MSG91_EMAIL_FROM: z.string().optional(),
  MSG91_WHATSAPP_NUMBER: z.string().optional(),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_WHATSAPP: z.string().optional(),
  MSG91_SMS_FLOW_ORDER_PLACED: z.string().optional(),
  MSG91_SMS_FLOW_SHIPPED: z.string().optional(),
  MSG91_SMS_FLOW_OFD: z.string().optional(),
  MSG91_SMS_FLOW_DELIVERY_FAILED: z.string().optional(),
  MSG91_SMS_FLOW_OTP: z.string().optional(),
  MSG91_WA_TEMPLATE_ORDER_PLACED: z.string().optional(),
  MSG91_WA_TEMPLATE_SHIPPED: z.string().optional(),
  MSG91_WA_TEMPLATE_OFD: z.string().optional(),
  MSG91_WA_TEMPLATE_DELIVERED: z.string().optional(),
  MSG91_WA_TEMPLATE_DELIVERY_FAILED: z.string().optional(),
  MSG91_WA_TEMPLATE_REFUND: z.string().optional(),
  MSG91_WA_TEMPLATE_ADMIN_NEW_ORDER: z.string().optional(),
  MSG91_WA_TEMPLATE_ADMIN_DELIVERY_FAILED: z.string().optional(),
  MSG91_EMAIL_TEMPLATE_ORDER_PLACED: z.string().optional(),
  MSG91_EMAIL_TEMPLATE_SHIPPED: z.string().optional(),
  MSG91_EMAIL_TEMPLATE_DELIVERED: z.string().optional(),
  MSG91_EMAIL_TEMPLATE_REFUND: z.string().optional(),
  MSG91_EMAIL_TEMPLATE_PASSWORD_RESET: z.string().optional(),
  MSG91_EMAIL_TEMPLATE_ADMIN_NEW_ORDER: z.string().optional(),
  MSG91_EMAIL_TEMPLATE_ADMIN_REFUND: z.string().optional(),
});

export const env = envSchema.parse(process.env);
