import { relations } from "drizzle-orm";
import { index, integer, jsonb, numeric, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { user } from "./auth";
import { productVariants } from "./catalog";
import { coupons } from "./coupons";

// ── Enums ─────────────────────────────────────────────────────────────────────

export const orderStatusEnum = pgEnum("order_status", [
  "pending_payment",
  "payment_failed",
  "paid",
  "processing",
  "picked_up",
  "out_for_delivery",
  "delivery_attempted",
  "shipped",
  "delivered",
  "cancelled",
  "refund_processing",
  "refunded",
  "rto_initiated",
  "rto_delivered",
  "return_requested",
  "return_approved",
  "exchange_requested",
]);

export const paymentGatewayEnum = pgEnum("payment_gateway", ["razorpay", "manual"]);

// How the customer paid for the order, and (if refunded) where the money went.
// "razorpay" = bank/card via Razorpay; "wallet" = in-app store credit.
export const paymentMethodEnum = pgEnum("payment_method", ["razorpay", "wallet"]);
export const refundMethodEnum = pgEnum("refund_method", ["razorpay", "wallet"]);

export const paymentAttemptStatusEnum = pgEnum("payment_attempt_status", [
  "created",
  "authorized",
  "captured",
  "failed",
  "refunded",
]);

// ── Orders ────────────────────────────────────────────────────────────────────

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderNumber: text("order_number").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),

    status: orderStatusEnum("status").notNull().default("pending_payment"),

    // Address snapshot (not FK — address could be deleted later)
    shippingAddress: jsonb("shipping_address").notNull(),

    // Financials (all snapshot at time of order)
    subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
    discountAmount: numeric("discount_amount", { precision: 10, scale: 2 }).notNull().default("0"),
    shippingCharge: numeric("shipping_charge", { precision: 10, scale: 2 }).notNull().default("0"),
    taxAmount: numeric("tax_amount", { precision: 10, scale: 2 }).notNull().default("0"),
    total: numeric("total", { precision: 10, scale: 2 }).notNull(),

    // Coupon (soft reference — coupon snapshot kept in discountAmount)
    couponId: uuid("coupon_id").references(() => coupons.id, { onDelete: "set null" }),
    couponCode: text("coupon_code"),

    // How this order is paid: "razorpay" (bank/card) or "wallet" (store credit).
    paymentMethod: paymentMethodEnum("payment_method").notNull().default("razorpay"),
    // Set when refunded, records where the money went (bank vs wallet).
    refundMethod: refundMethodEnum("refund_method"),

    // Payment gateway (null for wallet-paid orders)
    razorpayOrderId: text("razorpay_order_id"),
    razorpayPaymentId: text("razorpay_payment_id"),

    // Shipping (Shiprocket AWB — DB column name predates the Delhivery→Shiprocket switch)
    waybill: text("delhivery_waybill"),
    returnWaybill: text("return_waybill"),
    trackingUrl: text("tracking_url"),
    estimatedDeliveryDate: text("estimated_delivery_date"),
    podImageUrl: text("pod_image_url"),
    // Actual shipping cost Shiprocket charges us. Filled in by admin after dispatch.
    // shippingCharge (above) = what customer paid: 0 if cart >= free-shipping threshold, full rate otherwise.
    shippingCostActual: numeric("shipping_cost_actual", { precision: 10, scale: 2 }),

    // GST invoice — number (FY series e.g. AZ/26-27/0001), date, and stored PDF URL.
    // Generated once on payment success; taxAmount above holds the GST portion.
    gstInvoiceNumber: text("gst_invoice_number"),
    gstInvoiceDate: timestamp("gst_invoice_date"),
    invoiceUrl: text("invoice_url"),

    notes: text("notes"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index("orders_user_idx").on(t.userId),
    index("orders_status_idx").on(t.status),
    index("orders_razorpay_order_idx").on(t.razorpayOrderId),
    uniqueIndex("orders_gst_invoice_number_idx").on(t.gstInvoiceNumber),
  ],
);

// ── Order items (line items — fully snapshotted) ──────────────────────────────

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),

    // Soft reference — variant may be discontinued but order must remain intact
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "set null" }),

    // Snapshots (never rely on live product data for orders)
    productName: text("product_name").notNull(),
    variantSku: text("variant_sku").notNull(),
    sizeMl: integer("size_ml").notNull(),
    unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
    mrp: numeric("mrp", { precision: 10, scale: 2 }).notNull(),
    quantity: integer("quantity").notNull(),
    lineTotal: numeric("line_total", { precision: 10, scale: 2 }).notNull(),
    imageUrl: text("image_url"),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);

// ── Order status history (append-only audit trail) ────────────────────────────

export const orderStatusHistory = pgTable(
  "order_status_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    fromStatus: orderStatusEnum("from_status"),
    toStatus: orderStatusEnum("to_status").notNull(),
    note: text("note"),
    actorId: text("actor_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("order_status_history_order_idx").on(t.orderId)],
);

// ── Payment attempts (append-only) ───────────────────────────────────────────

export const paymentAttempts = pgTable(
  "payment_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    gateway: paymentGatewayEnum("gateway").notNull().default("razorpay"),
    gatewayOrderId: text("gateway_order_id"),
    gatewayPaymentId: text("gateway_payment_id"),
    status: paymentAttemptStatusEnum("status").notNull().default("created"),
    amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
    rawResponse: jsonb("raw_response"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("payment_attempts_order_idx").on(t.orderId),
    index("payment_attempts_gateway_order_idx").on(t.gatewayOrderId),
  ],
);

// ── Webhook events (idempotency log — one row per Razorpay event.id) ──────────

export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gateway: text("gateway").notNull(),
    eventId: text("event_id").notNull().unique(),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").notNull(),
    processedAt: timestamp("processed_at").defaultNow().notNull(),
  },
  (t) => [index("webhook_events_event_id_idx").on(t.eventId)],
);

// ── Relations ─────────────────────────────────────────────────────────────────

export const orderRelations = relations(orders, ({ one, many }) => ({
  user: one(user, { fields: [orders.userId], references: [user.id] }),
  coupon: one(coupons, { fields: [orders.couponId], references: [coupons.id] }),
  items: many(orderItems),
  statusHistory: many(orderStatusHistory),
  paymentAttempts: many(paymentAttempts),
}));

export const orderItemRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  variant: one(productVariants, { fields: [orderItems.variantId], references: [productVariants.id] }),
}));

export const orderStatusHistoryRelations = relations(orderStatusHistory, ({ one }) => ({
  order: one(orders, { fields: [orderStatusHistory.orderId], references: [orders.id] }),
}));

export const paymentAttemptRelations = relations(paymentAttempts, ({ one }) => ({
  order: one(orders, { fields: [paymentAttempts.orderId], references: [orders.id] }),
}));
