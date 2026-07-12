import { toMobile } from "./sms.js";
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
  orderId?: string; // internal UUID — used for the rating deep link
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

// Delivery confirmation + rating nudge — {{3}} is a deep link straight to the
// order page where the customer taps a star rating.
export async function notifyOrderDelivered(
  customer: CustomerContact,
  order: OrderInfo,
): Promise<void> {
  const mobile = customer.phone ? toMobile(customer.phone) : null;
  if (mobile && env.MSG91_WA_TEMPLATE_ORDER_DELIVERED) {
    const ratingUrl = order.orderId
      ? `${env.USER_APP_URL}/orders/${order.orderId}`
      : `${env.USER_APP_URL}/orders`;
    await fire(
      `wa:order_delivered:${order.orderNumber}`,
      sendWhatsapp(mobile, env.MSG91_WA_TEMPLATE_ORDER_DELIVERED!, [
        customer.name,
        order.orderNumber,
        ratingUrl,
      ]),
    );
  }
}

// Return/exchange pickup scheduled — courier will collect the item from the customer.
export async function notifyReturnPickupScheduled(
  customer: CustomerContact,
  order: OrderInfo,
): Promise<void> {
  const mobile = customer.phone ? toMobile(customer.phone) : null;
  if (mobile && env.MSG91_WA_TEMPLATE_RETURN_PICKUP) {
    await fire(
      `wa:return_pickup:${order.orderNumber}`,
      sendWhatsapp(mobile, env.MSG91_WA_TEMPLATE_RETURN_PICKUP!, [
        customer.name,
        order.orderNumber,
      ]),
    );
  }
}

// Auth OTP — email verification and password reset share one template ({{otp}}).
// better-auth awaits this via its background runner, so failures here never
// block the auth response; we still swallow errors to be safe.
export async function sendEmailOtp(email: string, otp: string): Promise<void> {
  const templateId = env.MSG91_EMAIL_TEMPLATE_OTP;
  if (!templateId) {
    if (process.env.NODE_ENV === "production") {
      console.error("[comms] MSG91_EMAIL_TEMPLATE_OTP not set — OTP email NOT sent");
    } else {
      console.warn(`[comms] MSG91_EMAIL_TEMPLATE_OTP not set — dev OTP for ${email}: ${otp}`);
    }
    return;
  }
  await fire(
    `email:otp:${email}`,
    sendEmail({
      to: email,
      name: email,
      subject: "Your Azimuth Perfumers verification code",
      templateId,
      vars: { otp },
    }),
  );
}

// Placeholder — new-product launch email campaign. Wire to the MSG91 campaign
// API once the campaign template and audience list exist.
export async function sendNewProductCampaign(product: {
  name: string;
  url: string;
}): Promise<void> {
  console.warn(`[comms] sendNewProductCampaign not implemented — skipped campaign for "${product.name}" (${product.url})`);
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

export async function alertAdminOrderDelivered(order: OrderInfo): Promise<void> {
  const adminWhatsapp = env.ADMIN_WHATSAPP;
  if (adminWhatsapp && env.MSG91_WA_TEMPLATE_ADMIN_ORDER_DELIVERED) {
    await fire(
      `wa:admin:order_delivered:${order.orderNumber}`,
      sendWhatsapp(adminWhatsapp, env.MSG91_WA_TEMPLATE_ADMIN_ORDER_DELIVERED!, [
        order.orderNumber,
      ]),
    );
  }
}

export async function alertAdminNewTicket(ticket: {
  ticketNumber: string;
  type: string;
  subject: string;
}): Promise<void> {
  const adminWhatsapp = env.ADMIN_WHATSAPP;
  if (adminWhatsapp && env.MSG91_WA_TEMPLATE_ADMIN_NEW_TICKET) {
    await fire(
      `wa:admin:new_ticket:${ticket.ticketNumber}`,
      sendWhatsapp(adminWhatsapp, env.MSG91_WA_TEMPLATE_ADMIN_NEW_TICKET!, [
        ticket.ticketNumber,
        ticket.type,
        ticket.subject,
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
