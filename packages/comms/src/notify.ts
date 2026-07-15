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
      sendWhatsapp(mobile, env.MSG91_WA_TEMPLATE_ORDER_PLACED!, {
        customer_name: customer.name,
        order_number: order.orderNumber,
        amount: order.totalInr,
      }),
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
      sendWhatsapp(mobile, env.MSG91_WA_TEMPLATE_REFUND!, {
        customer_name: customer.name,
        order_number: order.orderNumber,
        amount: order.totalInr,
      }),
    );
  }
}

// Delivery confirmation + rating nudge. The template carries a "Rate now" CTA
// button with dynamic URL https://<user-app>/orders/{{1}} — we send the suffix
// (order UUID + #rate), which deep-links to the rating section on the order page.
export async function notifyOrderDelivered(
  customer: CustomerContact,
  order: OrderInfo,
): Promise<void> {
  const mobile = customer.phone ? toMobile(customer.phone) : null;
  if (mobile && env.MSG91_WA_TEMPLATE_ORDER_DELIVERED) {
    await fire(
      `wa:order_delivered:${order.orderNumber}`,
      sendWhatsapp(
        mobile,
        env.MSG91_WA_TEMPLATE_ORDER_DELIVERED!,
        {
          customer_name: customer.name,
          order_number: order.orderNumber,
        },
        { buttonUrlParam: order.orderId ? `${order.orderId}#rate` : "" },
      ),
    );
  }
}

// Email verification LINK — sent on signup. Customer clicks {{verify_url}} to
// verify their email. better-auth awaits this in its background runner, so a
// failure here never blocks the auth response; we swallow errors to be safe.
export async function sendVerificationLink(email: string, name: string, url: string): Promise<void> {
  const templateId = env.MSG91_EMAIL_TEMPLATE_VERIFY;
  if (!templateId) {
    if (process.env.NODE_ENV === "production") {
      console.error("[comms] MSG91_EMAIL_TEMPLATE_VERIFY not set — verification email NOT sent");
    } else {
      console.warn(`[comms] MSG91_EMAIL_TEMPLATE_VERIFY not set — dev verify link for ${email}: ${url}`);
    }
    return;
  }
  await fire(
    `email:verify:${email}`,
    sendEmail({
      to: email,
      name,
      subject: "Verify your email — Azimuth Perfumers",
      templateId,
      vars: { customer_name: name, verify_url: url },
    }),
  );
}

// Auth OTP — password reset only ({{otp}}). Email verification uses the link above.
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
      subject: "Your Azimuth Perfumers password reset code",
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

// Admin templates carry a "View order" / "View ticket" CTA button with dynamic URL
// https://<admin-app>/orders/{{1}} (or /support/{{1}}) — we send the record UUID
// as the button suffix.

export async function alertAdminNewOrder(order: OrderInfo): Promise<void> {
  const adminWhatsapp = env.ADMIN_WHATSAPP;
  if (adminWhatsapp && env.MSG91_WA_TEMPLATE_ADMIN_NEW_ORDER) {
    await fire(
      `wa:admin:new_order:${order.orderNumber}`,
      sendWhatsapp(
        adminWhatsapp,
        env.MSG91_WA_TEMPLATE_ADMIN_NEW_ORDER!,
        {
          order_number: order.orderNumber,
          amount: order.totalInr,
        },
        { buttonUrlParam: order.orderId ?? "" },
      ),
    );
  }
}

export async function alertAdminOrderDelivered(order: OrderInfo): Promise<void> {
  const adminWhatsapp = env.ADMIN_WHATSAPP;
  if (adminWhatsapp && env.MSG91_WA_TEMPLATE_ADMIN_ORDER_DELIVERED) {
    await fire(
      `wa:admin:order_delivered:${order.orderNumber}`,
      sendWhatsapp(
        adminWhatsapp,
        env.MSG91_WA_TEMPLATE_ADMIN_ORDER_DELIVERED!,
        {
          order_number: order.orderNumber,
        },
        { buttonUrlParam: order.orderId ?? "" },
      ),
    );
  }
}

export async function alertAdminNewTicket(ticket: {
  ticketId: string;
  ticketNumber: string;
  type: string;
  subject: string;
}): Promise<void> {
  const adminWhatsapp = env.ADMIN_WHATSAPP;
  if (adminWhatsapp && env.MSG91_WA_TEMPLATE_ADMIN_NEW_TICKET) {
    await fire(
      `wa:admin:new_ticket:${ticket.ticketNumber}`,
      sendWhatsapp(
        adminWhatsapp,
        env.MSG91_WA_TEMPLATE_ADMIN_NEW_TICKET!,
        {
          ticket_id: ticket.ticketNumber,
          ticket_type: ticket.type,
          subject: ticket.subject,
        },
        { buttonUrlParam: ticket.ticketId },
      ),
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
      sendWhatsapp(
        adminWhatsapp,
        env.MSG91_WA_TEMPLATE_ADMIN_DELIVERY_FAILED!,
        { order_number: order.orderNumber },
        { buttonUrlParam: order.orderId ?? "" },
      ),
    );
  }
}

