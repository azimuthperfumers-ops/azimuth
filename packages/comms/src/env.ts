import { z } from "zod";

const schema = z.object({
  // MSG91 core
  MSG91_AUTH_KEY: z.string().optional(),
  MSG91_SENDER_ID: z.string().default("AZIMUT"),
  MSG91_EMAIL_DOMAIN: z.string().optional(),
  MSG91_EMAIL_FROM: z.string().optional(),
  MSG91_WHATSAPP_NUMBER: z.string().optional(),
  // Admin contact
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_WHATSAPP: z.string().optional(),
  // WhatsApp — primary customer + admin channel
  MSG91_WA_TEMPLATE_ORDER_PLACED: z.string().optional(),
  MSG91_WA_TEMPLATE_ORDER_DELIVERED: z.string().optional(), // delivery confirmation + "rate your purchase" nudge
  MSG91_WA_TEMPLATE_REFUND: z.string().optional(),
  MSG91_WA_TEMPLATE_ADMIN_NEW_ORDER: z.string().optional(),
  MSG91_WA_TEMPLATE_ADMIN_DELIVERY_FAILED: z.string().optional(),
  MSG91_WA_TEMPLATE_ADMIN_EXCHANGE_RECEIVED: z.string().optional(),
  // Email — link-based auth + admin paper trail only
  MSG91_EMAIL_TEMPLATE_PASSWORD_RESET: z.string().optional(),
  MSG91_EMAIL_TEMPLATE_ADMIN_REFUND: z.string().optional(),
});

export const env = schema.parse(process.env);
