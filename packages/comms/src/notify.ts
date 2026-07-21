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

// ── Customer notifications (email) ────────────────────────────────────────────

export async function notifyOrderPlaced(
  customer: CustomerContact,
  order: OrderInfo,
): Promise<void> {
  if (customer.email && env.MSG91_EMAIL_TEMPLATE_ORDER_PLACED) {
    await fire(
      `email:order_placed:${order.orderNumber}`,
      sendEmail({
        to: customer.email,
        name: customer.name,
        subject: `Order confirmed — ${order.orderNumber}`,
        templateId: env.MSG91_EMAIL_TEMPLATE_ORDER_PLACED!,
        vars: {
          customer_name: customer.name,
          order_number: order.orderNumber,
          amount: order.totalInr,
        },
      }),
    );
  }
}

// Where a refund was sent — spelled out for the customer so there's never a
// "where is my money?" ticket. Wallet credit is instant; bank takes 5–7 days.
export type RefundDestination = "wallet" | "razorpay";

function refundDestinationText(destination: RefundDestination): string {
  return destination === "wallet"
    ? "your Azimuth Wallet (store credit, available right away)"
    : "your original payment method — bank/card (5–7 business days)";
}

export async function notifyRefundInitiated(
  customer: CustomerContact,
  order: OrderInfo,
  destination: RefundDestination = "razorpay",
): Promise<void> {
  if (customer.email && env.MSG91_EMAIL_TEMPLATE_REFUND) {
    await fire(
      `email:refund:${order.orderNumber}`,
      sendEmail({
        to: customer.email,
        name: customer.name,
        subject: `Refund initiated — ${order.orderNumber}`,
        templateId: env.MSG91_EMAIL_TEMPLATE_REFUND!,
        vars: {
          customer_name: customer.name,
          order_number: order.orderNumber,
          amount: order.totalInr,
          refund_destination: refundDestinationText(destination),
        },
      }),
    );
  }
}

// Delivery confirmation + rating nudge. The email carries a "Rate now" link to
// {{rate_url}} = https://<user-app>/orders/<order UUID>#rate, which deep-links
// to the rating section on the order page.
export async function notifyOrderDelivered(
  customer: CustomerContact,
  order: OrderInfo,
): Promise<void> {
  if (customer.email && env.MSG91_EMAIL_TEMPLATE_ORDER_DELIVERED) {
    const rateUrl = order.orderId
      ? `${env.USER_APP_URL}/orders/${order.orderId}#rate`
      : env.USER_APP_URL;
    await fire(
      `email:order_delivered:${order.orderNumber}`,
      sendEmail({
        to: customer.email,
        name: customer.name,
        subject: `Your Azimuth order has been delivered — ${order.orderNumber}`,
        templateId: env.MSG91_EMAIL_TEMPLATE_ORDER_DELIVERED!,
        vars: {
          customer_name: customer.name,
          order_number: order.orderNumber,
          rate_url: rateUrl,
        },
      }),
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

// ── Admin alerts (email) ──────────────────────────────────────────────────────

// Admin templates carry a "View order" / "View ticket" link with the record's
// admin-panel URL, passed as {{order_url}} / {{ticket_url}}.

function adminOrderUrl(order: OrderInfo): string {
  return order.orderId ? `${env.ADMIN_APP_URL}/orders/${order.orderId}` : env.ADMIN_APP_URL;
}

export async function alertAdminNewOrder(order: OrderInfo): Promise<void> {
  if (env.ADMIN_EMAIL && env.MSG91_EMAIL_TEMPLATE_ADMIN_NEW_ORDER) {
    await fire(
      `email:admin:new_order:${order.orderNumber}`,
      sendEmail({
        to: env.ADMIN_EMAIL,
        name: "Azimuth Admin",
        subject: `New order — ${order.orderNumber} (${order.totalInr})`,
        templateId: env.MSG91_EMAIL_TEMPLATE_ADMIN_NEW_ORDER!,
        vars: {
          order_number: order.orderNumber,
          amount: order.totalInr,
          order_url: adminOrderUrl(order),
        },
      }),
    );
  }
}

export async function alertAdminOrderDelivered(order: OrderInfo): Promise<void> {
  if (env.ADMIN_EMAIL && env.MSG91_EMAIL_TEMPLATE_ADMIN_ORDER_DELIVERED) {
    await fire(
      `email:admin:order_delivered:${order.orderNumber}`,
      sendEmail({
        to: env.ADMIN_EMAIL,
        name: "Azimuth Admin",
        subject: `Order delivered — ${order.orderNumber}`,
        templateId: env.MSG91_EMAIL_TEMPLATE_ADMIN_ORDER_DELIVERED!,
        vars: {
          order_number: order.orderNumber,
          order_url: adminOrderUrl(order),
        },
      }),
    );
  }
}

export async function alertAdminNewTicket(ticket: {
  ticketId: string;
  ticketNumber: string;
  type: string;
  subject: string;
}): Promise<void> {
  if (env.ADMIN_EMAIL && env.MSG91_EMAIL_TEMPLATE_ADMIN_NEW_TICKET) {
    await fire(
      `email:admin:new_ticket:${ticket.ticketNumber}`,
      sendEmail({
        to: env.ADMIN_EMAIL,
        name: "Azimuth Admin",
        subject: `New support ticket — ${ticket.ticketNumber}`,
        templateId: env.MSG91_EMAIL_TEMPLATE_ADMIN_NEW_TICKET!,
        vars: {
          ticket_id: ticket.ticketNumber,
          ticket_type: ticket.type,
          subject: ticket.subject,
          ticket_url: `${env.ADMIN_APP_URL}/support/${ticket.ticketId}`,
        },
      }),
    );
  }
}

export async function alertAdminRefund(
  order: OrderInfo,
  destination: RefundDestination = "razorpay",
): Promise<void> {
  const destinationText = destination === "wallet" ? "Wallet (store credit)" : "Bank / card (Razorpay)";
  if (env.ADMIN_EMAIL && env.MSG91_EMAIL_TEMPLATE_ADMIN_REFUND) {
    await fire(
      `email:admin:refund:${order.orderNumber}`,
      sendEmail({
        to: env.ADMIN_EMAIL,
        name: "Azimuth Admin",
        subject: `Refund initiated — ${order.orderNumber} (${order.totalInr})`,
        templateId: env.MSG91_EMAIL_TEMPLATE_ADMIN_REFUND!,
        vars: {
          order_number: order.orderNumber,
          amount: order.totalInr,
          refund_destination: destinationText,
        },
      }),
    );
  }
}

export async function alertAdminDeliveryFailed(order: OrderInfo): Promise<void> {
  if (env.ADMIN_EMAIL && env.MSG91_EMAIL_TEMPLATE_ADMIN_DELIVERY_FAILED) {
    await fire(
      `email:admin:delivery_failed:${order.orderNumber}`,
      sendEmail({
        to: env.ADMIN_EMAIL,
        name: "Azimuth Admin",
        subject: `Delivery failed — ${order.orderNumber}`,
        templateId: env.MSG91_EMAIL_TEMPLATE_ADMIN_DELIVERY_FAILED!,
        vars: {
          order_number: order.orderNumber,
          order_url: adminOrderUrl(order),
        },
      }),
    );
  }
}
