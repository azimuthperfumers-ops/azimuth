import { sendSms, toMobile } from "./sms.js";
import { sendWhatsapp } from "./whatsapp.js";
import { sendEmail } from "./email.js";
import { env } from "./env.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CustomerContact {
  name: string;
  email?: string | null;
  phone?: string | null;
}

export interface OrderInfo {
  orderNumber: string;
  totalInr: string;
  waybill?: string | null;
  trackingUrl?: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fire(label: string, p: Promise<void>): Promise<void> {
  try {
    await p;
  } catch (err) {
    console.error(`[comms] ${label} failed:`, (err as Error).message);
  }
}

// ── Customer notifications ────────────────────────────────────────────────────

// WhatsApp only — primary channel in India; courier tracking handled by Shiprocket
export async function notifyOrderPlaced(
  customer: CustomerContact,
  order: OrderInfo,
): Promise<void> {
  const mobile = customer.phone ? toMobile(customer.phone) : null;
  if (mobile && env.MSG91_WA_TEMPLATE_ORDER_PLACED) {
    await fire(
      `wa:order_placed:${order.orderNumber}`,
      sendWhatsapp(mobile, env.MSG91_WA_TEMPLATE_ORDER_PLACED!, [
        customer.name,
        order.orderNumber,
        order.totalInr,
      ]),
    );
  }
}

export async function notifyRefundInitiated(
  customer: CustomerContact,
  order: OrderInfo,
): Promise<void> {
  const mobile = customer.phone ? toMobile(customer.phone) : null;
  if (mobile && env.MSG91_WA_TEMPLATE_REFUND) {
    await fire(
      `wa:refund:${order.orderNumber}`,
      sendWhatsapp(mobile, env.MSG91_WA_TEMPLATE_REFUND!, [
        customer.name,
        order.orderNumber,
        order.totalInr,
      ]),
    );
  }
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function sendOtp(phone: string, otp: string): Promise<void> {
  const flowId = env.MSG91_SMS_FLOW_OTP;
  if (!flowId) {
    console.warn("[comms] MSG91_SMS_FLOW_OTP not set — OTP not sent");
    return;
  }
  await sendSms(toMobile(phone), flowId, { otp });
}

export async function sendPasswordReset(
  email: string,
  name: string,
  resetUrl: string,
): Promise<void> {
  const templateId = env.MSG91_EMAIL_TEMPLATE_PASSWORD_RESET;
  if (!templateId) {
    console.warn("[comms] MSG91_EMAIL_TEMPLATE_PASSWORD_RESET not set");
    return;
  }
  await fire(
    `email:password_reset:${email}`,
    sendEmail({
      to: email,
      name,
      subject: "Reset your Azimuth Perfumers password",
      templateId,
      vars: { name, reset_url: resetUrl },
    }),
  );
}

// ── Admin alerts (WhatsApp) ───────────────────────────────────────────────────

export async function alertAdminNewOrder(order: OrderInfo): Promise<void> {
  const adminWhatsapp = env.ADMIN_WHATSAPP;
  if (adminWhatsapp && env.MSG91_WA_TEMPLATE_ADMIN_NEW_ORDER) {
    await fire(
      `wa:admin:new_order:${order.orderNumber}`,
      sendWhatsapp(adminWhatsapp, env.MSG91_WA_TEMPLATE_ADMIN_NEW_ORDER!, [
        order.orderNumber,
        order.totalInr,
      ]),
    );
  }
}

export async function alertAdminRefund(order: OrderInfo): Promise<void> {
  const adminEmail = env.ADMIN_EMAIL;
  if (adminEmail && env.MSG91_EMAIL_TEMPLATE_ADMIN_REFUND) {
    await fire(
      `email:admin:refund:${order.orderNumber}`,
      sendEmail({
        to: adminEmail,
        name: "Azimuth Admin",
        subject: `Refund initiated — ${order.orderNumber} (${order.totalInr})`,
        templateId: env.MSG91_EMAIL_TEMPLATE_ADMIN_REFUND!,
        vars: { order_number: order.orderNumber, amount: order.totalInr },
      }),
    );
  }
}

export async function alertAdminDeliveryFailed(order: OrderInfo): Promise<void> {
  const adminWhatsapp = env.ADMIN_WHATSAPP;
  if (adminWhatsapp && env.MSG91_WA_TEMPLATE_ADMIN_DELIVERY_FAILED) {
    await fire(
      `wa:admin:delivery_failed:${order.orderNumber}`,
      sendWhatsapp(adminWhatsapp, env.MSG91_WA_TEMPLATE_ADMIN_DELIVERY_FAILED!, [order.orderNumber]),
    );
  }
}

export async function alertAdminExchangeReceived(order: OrderInfo): Promise<void> {
  const adminWhatsapp = env.ADMIN_WHATSAPP;
  const template = env.MSG91_WA_TEMPLATE_ADMIN_EXCHANGE_RECEIVED;
  if (adminWhatsapp && template) {
    await fire(
      `wa:admin:exchange_received:${order.orderNumber}`,
      sendWhatsapp(adminWhatsapp, template, [order.orderNumber]),
    );
  }
}
