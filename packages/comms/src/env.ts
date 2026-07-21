import { z } from "zod";

const schema = z.object({
  // MSG91 core
  MSG91_AUTH_KEY: z.string().optional(),
  MSG91_SENDER_ID: z.string().default("AZIMUT"),
  MSG91_EMAIL_DOMAIN: z.string().optional(),
  MSG91_EMAIL_FROM: z.string().optional(),
  // Admin contact — all admin alerts go here by email
  ADMIN_EMAIL: z.string().email().optional(),
  // Email — customer transactional templates (MSG91 email template IDs)
  MSG91_EMAIL_TEMPLATE_ORDER_PLACED: z.string().optional(),
  MSG91_EMAIL_TEMPLATE_ORDER_DELIVERED: z.string().optional(), // delivery confirmation + "rate your purchase" link
  MSG91_EMAIL_TEMPLATE_REFUND: z.string().optional(),
  // Email — auth (verification link + password-reset OTP)
  MSG91_EMAIL_TEMPLATE_VERIFY: z.string().optional(), // signup email-verification link
  MSG91_EMAIL_TEMPLATE_OTP: z.string().optional(),    // password-reset OTP code
  // Email — admin alerts
  MSG91_EMAIL_TEMPLATE_ADMIN_NEW_ORDER: z.string().optional(),
  MSG91_EMAIL_TEMPLATE_ADMIN_ORDER_DELIVERED: z.string().optional(),
  MSG91_EMAIL_TEMPLATE_ADMIN_NEW_TICKET: z.string().optional(),
  MSG91_EMAIL_TEMPLATE_ADMIN_DELIVERY_FAILED: z.string().optional(),
  MSG91_EMAIL_TEMPLATE_ADMIN_REFUND: z.string().optional(),
  // App origins — deep links inside emails
  USER_APP_URL: z.string().default("http://localhost:3000"),   // customer "rate your purchase" link
  ADMIN_APP_URL: z.string().default("http://localhost:3001"),  // admin "view order/ticket" links
});

export const env = schema.parse(process.env);
