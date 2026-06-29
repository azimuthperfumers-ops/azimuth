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
  totalInr: string;       // formatted, e.g. "₹1,234"
  waybill?: string | null;
  trackingUrl?: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// fire-and-forget — log error, never throw (comms must not crash order flow)
async function fire(label: string, p: Promise<void>): Promise<void> {
  try {
    await p;
  } catch (err) {
    console.error(`[comms] ${label} failed:`, (err as Error).message);
  }
}

// ── Order lifecycle ───────────────────────────────────────────────────────────

export async function notifyOrderPlaced(
  customer: CustomerContact,
  order: OrderInfo,
): Promise<void> {
  const mobile = customer.phone ? toMobile(customer.phone) : null;

  if (mobile && env.MSG91_SMS_FLOW_ORDER_PLACED) {
    await fire(
      `sms:order_placed:${order.orderNumber}`,
      sendSms(mobile, env.MSG91_SMS_FLOW_ORDER_PLACED!, {
        name: customer.name,
        order_number: order.orderNumber,
        amount: order.totalInr,
      }),
    );
  }

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

  if (customer.email && env.MSG91_EMAIL_TEMPLATE_ORDER_PLACED) {
    await fire(
      `email:order_placed:${order.orderNumber}`,
      sendEmail({
        to: customer.email,
        name: customer.name,
        subject: `Order confirmed — ${order.orderNumber}`,
        templateId: env.MSG91_EMAIL_TEMPLATE_ORDER_PLACED!,
        vars: {
          name: customer.name,
          order_number: order.orderNumber,
          amount: order.totalInr,
        },
      }),
    );
  }
}

export async function notifyShipped(
  customer: CustomerContact,
  order: OrderInfo,
): Promise<void> {
  const mobile = customer.phone ? toMobile(customer.phone) : null;
  const waybill = order.waybill ?? "";
  const trackUrl = order.trackingUrl ?? "";

  if (mobile && env.MSG91_SMS_FLOW_SHIPPED) {
    await fire(
      `sms:shipped:${order.orderNumber}`,
      sendSms(mobile, env.MSG91_SMS_FLOW_SHIPPED!, {
        name: customer.name,
        order_number: order.orderNumber,
        waybill,
        track_url: trackUrl,
      }),
    );
  }

  if (mobile && env.MSG91_WA_TEMPLATE_SHIPPED) {
    await fire(
      `wa:shipped:${order.orderNumber}`,
      sendWhatsapp(mobile, env.MSG91_WA_TEMPLATE_SHIPPED!, [
        customer.name,
        order.orderNumber,
        waybill,
        trackUrl,
      ]),
    );
  }

  if (customer.email && env.MSG91_EMAIL_TEMPLATE_SHIPPED) {
    await fire(
      `email:shipped:${order.orderNumber}`,
      sendEmail({
        to: customer.email,
        name: customer.name,
        subject: `Your order ${order.orderNumber} has shipped`,
        templateId: env.MSG91_EMAIL_TEMPLATE_SHIPPED!,
        vars: {
          name: customer.name,
          order_number: order.orderNumber,
          waybill,
          track_url: trackUrl,
        },
      }),
    );
  }
}

export async function notifyOutForDelivery(
  customer: CustomerContact,
  order: OrderInfo,
): Promise<void> {
  const mobile = customer.phone ? toMobile(customer.phone) : null;

  if (mobile && env.MSG91_SMS_FLOW_OFD) {
    await fire(
      `sms:ofd:${order.orderNumber}`,
      sendSms(mobile, env.MSG91_SMS_FLOW_OFD!, {
        name: customer.name,
        order_number: order.orderNumber,
      }),
    );
  }

  if (mobile && env.MSG91_WA_TEMPLATE_OFD) {
    await fire(
      `wa:ofd:${order.orderNumber}`,
      sendWhatsapp(mobile, env.MSG91_WA_TEMPLATE_OFD!, [
        customer.name,
        order.orderNumber,
      ]),
    );
  }
}

export async function notifyDelivered(
  customer: CustomerContact,
  order: OrderInfo,
): Promise<void> {
  const mobile = customer.phone ? toMobile(customer.phone) : null;

  if (mobile && env.MSG91_WA_TEMPLATE_DELIVERED) {
    await fire(
      `wa:delivered:${order.orderNumber}`,
      sendWhatsapp(mobile, env.MSG91_WA_TEMPLATE_DELIVERED!, [
        customer.name,
        order.orderNumber,
      ]),
    );
  }

  if (customer.email && env.MSG91_EMAIL_TEMPLATE_DELIVERED) {
    await fire(
      `email:delivered:${order.orderNumber}`,
      sendEmail({
        to: customer.email,
        name: customer.name,
        subject: `Your order ${order.orderNumber} has been delivered`,
        templateId: env.MSG91_EMAIL_TEMPLATE_DELIVERED!,
        vars: { name: customer.name, order_number: order.orderNumber },
      }),
    );
  }
}

export async function notifyDeliveryFailed(
  customer: CustomerContact,
  order: OrderInfo,
): Promise<void> {
  const mobile = customer.phone ? toMobile(customer.phone) : null;

  if (mobile && env.MSG91_SMS_FLOW_DELIVERY_FAILED) {
    await fire(
      `sms:failed:${order.orderNumber}`,
      sendSms(mobile, env.MSG91_SMS_FLOW_DELIVERY_FAILED!, {
        name: customer.name,
        order_number: order.orderNumber,
      }),
    );
  }

  if (mobile && env.MSG91_WA_TEMPLATE_DELIVERY_FAILED) {
    await fire(
      `wa:failed:${order.orderNumber}`,
      sendWhatsapp(mobile, env.MSG91_WA_TEMPLATE_DELIVERY_FAILED!, [
        customer.name,
        order.orderNumber,
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

  if (customer.email && env.MSG91_EMAIL_TEMPLATE_REFUND) {
    await fire(
      `email:refund:${order.orderNumber}`,
      sendEmail({
        to: customer.email,
        name: customer.name,
        subject: `Refund initiated — ${order.orderNumber}`,
        templateId: env.MSG91_EMAIL_TEMPLATE_REFUND!,
        vars: {
          name: customer.name,
          order_number: order.orderNumber,
          amount: order.totalInr,
        },
      }),
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

// ── Admin alerts ──────────────────────────────────────────────────────────────

export async function alertAdminNewOrder(order: OrderInfo): Promise<void> {
  const adminEmail = env.ADMIN_EMAIL;
  const adminWhatsapp = env.ADMIN_WHATSAPP;

  if (adminEmail && env.MSG91_EMAIL_TEMPLATE_ADMIN_NEW_ORDER) {
    await fire(
      `email:admin:new_order:${order.orderNumber}`,
      sendEmail({
        to: adminEmail,
        name: "Azimuth Admin",
        subject: `New order — ${order.orderNumber} (${order.totalInr})`,
        templateId: env.MSG91_EMAIL_TEMPLATE_ADMIN_NEW_ORDER!,
        vars: { order_number: order.orderNumber, amount: order.totalInr },
      }),
    );
  }

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
        subject: `Refund needed — ${order.orderNumber} (${order.totalInr})`,
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
      sendWhatsapp(
        adminWhatsapp,
        env.MSG91_WA_TEMPLATE_ADMIN_DELIVERY_FAILED!,
        [order.orderNumber],
      ),
    );
  }
}

export async function alertAdminExchangeReceived(order: OrderInfo): Promise<void> {
  const adminWhatsapp = env.ADMIN_WHATSAPP;
  if (adminWhatsapp) {
    await fire(
      `wa:admin:exchange_received:${order.orderNumber}`,
      sendWhatsapp(adminWhatsapp, "exchange_received_v1", [order.orderNumber]),
    );
  }
}
