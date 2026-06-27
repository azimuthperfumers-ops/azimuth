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
  // SMS flow IDs (MSG91 dashboard → SMS → Flows)
  MSG91_SMS_FLOW_ORDER_PLACED: z.string().optional(),
  MSG91_SMS_FLOW_SHIPPED: z.string().optional(),
  MSG91_SMS_FLOW_OFD: z.string().optional(),
  MSG91_SMS_FLOW_DELIVERY_FAILED: z.string().optional(),
  MSG91_SMS_FLOW_OTP: z.string().optional(),
  // WhatsApp template names (Meta-approved)
  MSG91_WA_TEMPLATE_ORDER_PLACED: z.string().optional(),
  MSG91_WA_TEMPLATE_SHIPPED: z.string().optional(),
  MSG91_WA_TEMPLATE_OFD: z.string().optional(),
  MSG91_WA_TEMPLATE_DELIVERED: z.string().optional(),
  MSG91_WA_TEMPLATE_DELIVERY_FAILED: z.string().optional(),
  MSG91_WA_TEMPLATE_REFUND: z.string().optional(),
  MSG91_WA_TEMPLATE_ADMIN_NEW_ORDER: z.string().optional(),
  MSG91_WA_TEMPLATE_ADMIN_DELIVERY_FAILED: z.string().optional(),
  // Email template IDs (MSG91 dashboard → Email → Templates)
  MSG91_EMAIL_TEMPLATE_ORDER_PLACED: z.string().optional(),
  MSG91_EMAIL_TEMPLATE_SHIPPED: z.string().optional(),
  MSG91_EMAIL_TEMPLATE_DELIVERED: z.string().optional(),
  MSG91_EMAIL_TEMPLATE_REFUND: z.string().optional(),
  MSG91_EMAIL_TEMPLATE_PASSWORD_RESET: z.string().optional(),
  MSG91_EMAIL_TEMPLATE_ADMIN_NEW_ORDER: z.string().optional(),
  MSG91_EMAIL_TEMPLATE_ADMIN_REFUND: z.string().optional(),
});

export const env = schema.parse(process.env);
