import { and, asc, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";

import type { Database } from "@azimuth/db";
import { schema } from "@azimuth/db";

// ── Order number generation ───────────────────────────────────────────────────

export async function generateOrderNumber(db: Database): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `AZ-${year}-`;

  // Count orders this year to get next sequence
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.orders)
    .where(sql`"order_number" LIKE ${prefix + "%"}`);

  const next = (result[0]?.count ?? 0) + 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

// ── Create order (wraps transaction) ─────────────────────────────────────────

export type CreateOrderInput = {
  userId: string;
  shippingAddress: {
    fullName: string;
    phone: string;
    line1: string;
    line2?: string | null;
    city: string;
    state: string;
    pincode: string;
    label?: string;
  };
  items: {
    variantId: string;
    productName: string;
    variantSku: string;
    sizeMl: number;
    unitPrice: number;
    mrp: number;
    quantity: number;
    imageUrl?: string | null;
  }[];
  subtotal: number;
  discountAmount: number;
  shippingCharge: number;
  taxAmount: number;
  total: number;
  couponId?: string | null;
  couponCode?: string | null;
  paymentMethod?: "razorpay" | "wallet";
};

function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === "23505" || e?.cause?.code === "23505";
}

export async function createOrder(db: Database, input: CreateOrderInput) {
  // Order number comes from a count — two concurrent checkouts can collide on the
  // unique index. Retry with a fresh count instead of failing the checkout.
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await createOrderOnce(db, input);
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      lastErr = err;
    }
  }
  throw lastErr;
}

async function createOrderOnce(db: Database, input: CreateOrderInput) {
  return db.transaction(async (tx) => {
    const orderNumber = await generateOrderNumber(tx as unknown as Database);

    const [order] = await tx
      .insert(schema.orders)
      .values({
        orderNumber,
        userId: input.userId,
        shippingAddress: input.shippingAddress,
        subtotal: String(input.subtotal),
        discountAmount: String(input.discountAmount),
        shippingCharge: String(input.shippingCharge),
        taxAmount: String(input.taxAmount),
        total: String(input.total),
        couponId: input.couponId ?? null,
        couponCode: input.couponCode ?? null,
        paymentMethod: input.paymentMethod ?? "razorpay",
        status: "pending_payment",
      })
      .returning();

    if (!order) throw new Error("Failed to create order");

    await tx.insert(schema.orderItems).values(
      input.items.map((item) => ({
        orderId: order.id,
        variantId: item.variantId,
        productName: item.productName,
        variantSku: item.variantSku,
        sizeMl: item.sizeMl,
        unitPrice: String(item.unitPrice),
        mrp: String(item.mrp),
        quantity: item.quantity,
        lineTotal: String(item.unitPrice * item.quantity),
        imageUrl: item.imageUrl ?? null,
      })),
    );

    // First status history entry
    await tx.insert(schema.orderStatusHistory).values({
      orderId: order.id,
      fromStatus: null,
      toStatus: "pending_payment",
      note: "Order created",
      actorId: input.userId,
    });

    // Mark coupon used
    if (input.couponId) {
      await tx
        .update(schema.coupons)
        .set({ usedCount: sql`"used_count" + 1` })
        .where(eq(schema.coupons.id, input.couponId));

      await tx.insert(schema.couponUsages).values({
        couponId: input.couponId,
        userId: input.userId,
        orderId: order.id,
      });
    }

    // Cart is cleared once payment is verified (payment.verifyAndConfirmPayment),
    // not here — an order can be created and never paid for, and the cart should
    // survive that.

    return order;
  });
}

// ── Order-driven inventory movements ─────────────────────────────────────────
// Decrement on paid, restore when goods physically return. Idempotent: one ledger
// row per (order, variant, reason) — safe to call from webhook retries and sweeps.

import { createInventoryRepository } from "./inventory.repository";

export type OrderStockMovement = "sale" | "return";

export async function applyOrderStockMovement(
  db: Database,
  orderId: string,
  movement: OrderStockMovement,
  note?: string,
) {
  const items = await db.query.orderItems.findMany({
    where: eq(schema.orderItems.orderId, orderId),
  });

  const inventory = createInventoryRepository(db);
  const outbound = movement === "sale";

  for (const item of items) {
    if (!item.variantId) continue; // variant deleted — snapshot order, nothing to move

    const [existing] = await db
      .select({ id: schema.inventoryLedger.id })
      .from(schema.inventoryLedger)
      .where(
        and(
          eq(schema.inventoryLedger.refType, "order"),
          eq(schema.inventoryLedger.refId, orderId),
          eq(schema.inventoryLedger.variantId, item.variantId),
          eq(schema.inventoryLedger.reason, movement),
        ),
      )
      .limit(1);
    if (existing) continue;

    try {
      await inventory.recordMovement({
        variantId: item.variantId,
        delta: outbound ? -item.quantity : item.quantity,
        reason: movement,
        refType: "order",
        refId: orderId,
        note,
        // Money is already captured for order-driven sales — never block the order
        // pipeline on a stock guard; negative stock = oversold flag for admin.
        allowNegative: outbound,
      });
    } catch (err) {
      // Inventory must never break payment/shipping processing — log and move on
      console.error(
        `[inventory] ${movement} movement failed for order=${orderId} variant=${item.variantId}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
}

// ── Advance order status ──────────────────────────────────────────────────────

export async function advanceOrderStatus(
  db: Database,
  orderId: string,
  toStatus: typeof schema.orders.$inferSelect["status"],
  actorId: string,
  note?: string,
) {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({ status: schema.orders.status })
      .from(schema.orders)
      .where(eq(schema.orders.id, orderId));

    if (!current) throw new Error("Order not found");

    const [updated] = await tx
      .update(schema.orders)
      .set({ status: toStatus })
      .where(eq(schema.orders.id, orderId))
      .returning();

    await tx.insert(schema.orderStatusHistory).values({
      orderId,
      fromStatus: current.status!,
      toStatus,
      note: note ?? null,
      actorId,
    });

    return updated;
  });
}

// ── Queries ───────────────────────────────────────────────────────────────────

export async function getUserOrders(db: Database, userId: string) {
  const orders = await db.query.orders.findMany({
    where: eq(schema.orders.userId, userId),
    with: { items: true, shipments: { orderBy: asc(schema.orderShipments.packageNumber) } },
    orderBy: desc(schema.orders.createdAt),
  });
  // RTO legs are internal — the customer's list shows those orders as cancelled,
  // and each parcel gets the same masking (see toCustomerShipment).
  return orders.map((o) => ({
    ...o,
    status: RTO_STATUSES.has(o.status) ? ("cancelled" as typeof o.status) : o.status,
    shipments: o.shipments.map(toCustomerShipment),
  }));
}

function resolveImageKey(key: string) {
  if (key.startsWith("https://") || key.startsWith("http://")) return key;
  const base = (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, "");
  return `${base}/${key}`;
}

async function enrichItemImages<T extends { items: { variantId: string | null; imageUrl: string | null }[] }>(
  db: Database,
  order: T | undefined,
): Promise<T | undefined> {
  if (!order) return order;
  const variantIds = order.items.map((i) => i.variantId).filter(Boolean) as string[];
  if (variantIds.length === 0) return order;

  // variantId → productId via product_variants
  const variants = await db.query.productVariants.findMany({
    where: inArray(schema.productVariants.id, variantIds),
    columns: { id: true, productId: true },
  });
  const variantToProduct = new Map(variants.map((v) => [v.id, v.productId]));
  const productIds = [...new Set(variants.map((v) => v.productId))];
  if (productIds.length === 0) return order;

  const images = await db.query.productImages.findMany({
    where: and(inArray(schema.productImages.productId, productIds), eq(schema.productImages.isPrimary, true)),
  });
  const productToImage = new Map(images.map((img) => [img.productId, img.key]));

  return {
    ...order,
    items: order.items.map((item) => {
      if (item.imageUrl) return item;
      const productId = item.variantId ? variantToProduct.get(item.variantId) : undefined;
      const key = productId ? productToImage.get(productId) : undefined;
      return { ...item, imageUrl: key ? resolveImageKey(key) : item.imageUrl };
    }),
  };
}

// ── Customer-facing view of an order ─────────────────────────────────────────
// Admin sees everything; the customer gets a curated view:
//  - RTO legs (parcel travelling back to the warehouse after a cancellation or
//    failed delivery) are internal logistics — masked as "cancelled".
//  - History notes carry internal detail (payment ids, courier chatter, admin
//    remarks) — stripped entirely.
//  - History entries for internal-only statuses, no-op annotations
//    (from == to) and anything after the cancellation are dropped.

const USER_VISIBLE_STATUSES = new Set([
  "pending_payment",
  "payment_failed",
  "paid",
  "processing",
  "picked_up",
  "shipped",
  "out_for_delivery",
  "delivery_attempted",
  "delivered",
  "cancelled",
  "refund_processing",
  "refunded",
]);

const RTO_STATUSES = new Set(["rto_initiated", "rto_delivered"]);

// Per-parcel equivalent of the order-level masking. A parcel travelling back to
// the warehouse is internal logistics, so it reads as "cancelled" to the customer
// exactly like the order status does.
const SHIPMENT_RTO_STATUSES = new Set(["rto_initiated", "rto_delivered"]);

type CustomerShipment = {
  status: string;
  errorMessage?: string | null;
  shippingCostActual?: string | null;
  shippingChargeQuoted?: string | null;
} & Record<string, unknown>;

// Strips internal-only parcel fields: the raw courier failure text and what the
// courier billed us (which is not what the customer paid). Generic so callers keep
// the concrete parcel shape — clients read waybill/packageNumber off these rows.
function toCustomerShipment<T extends CustomerShipment>(
  shipment: T,
): Omit<T, "errorMessage" | "shippingCostActual"> {
  const { errorMessage: _err, shippingCostActual: _cost, ...visible } = shipment;
  return {
    ...visible,
    status: SHIPMENT_RTO_STATUSES.has(shipment.status) ? "cancelled" : shipment.status,
  } as Omit<T, "errorMessage" | "shippingCostActual">;
}

type OrderWithHistory = {
  status: string;
  statusHistory?: { fromStatus: string | null; toStatus: string; note: string | null; actorId: string | null }[];
  shipments?: CustomerShipment[];
} & Record<string, unknown>;

function toCustomerView<T extends OrderWithHistory | undefined>(order: T): T {
  if (!order) return order;
  const masked = {
    ...order,
    status: RTO_STATUSES.has(order.status) ? "cancelled" : order.status,
  };
  if (order.statusHistory) {
    masked.statusHistory = order.statusHistory
      .filter(
        (h) =>
          USER_VISIBLE_STATUSES.has(h.toStatus) &&
          h.fromStatus !== h.toStatus, // internal annotations write from == to
      )
      .map((h) => ({ ...h, note: null, actorId: null }));
  }
  if (order.shipments) {
    // Omit<> drops the index signature that CustomerShipment carries, so the
    // element type no longer matches structurally even though the data does.
    masked.shipments = order.shipments.map(toCustomerShipment) as CustomerShipment[];
  }
  return masked as T;
}

export async function getOrderById(db: Database, orderId: string, userId?: string) {
  const where = userId
    ? and(eq(schema.orders.id, orderId), eq(schema.orders.userId, userId))
    : eq(schema.orders.id, orderId);

  const order = await db.query.orders.findFirst({
    where,
    with: {
      items: true,
      // One row per physical parcel — an order of N units ships as N packages.
      shipments: { orderBy: asc(schema.orderShipments.packageNumber) },
      statusHistory: { orderBy: desc(schema.orderStatusHistory.createdAt) },
      paymentAttempts: { orderBy: desc(schema.paymentAttempts.createdAt) },
    },
  });
  const enriched = await enrichItemImages(db, order);
  // userId present = customer-scoped call → curated view. Admin passes no userId.
  return userId ? toCustomerView(enriched) : enriched;
}

export async function getOrderByNumber(db: Database, orderNumber: string, userId?: string) {
  const where = userId
    ? and(eq(schema.orders.orderNumber, orderNumber), eq(schema.orders.userId, userId))
    : eq(schema.orders.orderNumber, orderNumber);

  const order = await db.query.orders.findFirst({
    where,
    with: {
      items: true,
      // One row per physical parcel — an order of N units ships as N packages.
      shipments: { orderBy: asc(schema.orderShipments.packageNumber) },
      statusHistory: { orderBy: desc(schema.orderStatusHistory.createdAt) },
      paymentAttempts: { orderBy: desc(schema.paymentAttempts.createdAt) },
    },
  });
  const enriched = await enrichItemImages(db, order);
  return userId ? toCustomerView(enriched) : enriched;
}

export async function getAllOrders(
  db: Database,
  opts: {
    status?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
  } = {},
) {
  const { limit = 50, offset = 0 } = opts;

  const conditions = [];

  if (opts.status) {
    conditions.push(eq(schema.orders.status, opts.status as typeof schema.orders.$inferSelect["status"]));
  }
  if (opts.search) {
    const q = `%${opts.search}%`;
    conditions.push(
      or(
        ilike(schema.orders.orderNumber, q),
        sql`${schema.orders.shippingAddress}->>'fullName' ILIKE ${q}`,
        sql`${schema.orders.shippingAddress}->>'phone' ILIKE ${q}`,
        ilike(schema.orders.waybill, q),
        // Support hands us whichever AWB the customer quotes, and only the first
        // parcel's is mirrored onto the order — search every parcel.
        sql`EXISTS (
          SELECT 1 FROM ${schema.orderShipments}
          WHERE ${schema.orderShipments.orderId} = ${schema.orders.id}
            AND ${schema.orderShipments.waybill} ILIKE ${q}
        )`,
      ),
    );
  }
  if (opts.dateFrom) {
    conditions.push(gte(schema.orders.createdAt, new Date(opts.dateFrom)));
  }
  if (opts.dateTo) {
    const to = new Date(opts.dateTo);
    to.setHours(23, 59, 59, 999);
    conditions.push(lte(schema.orders.createdAt, to));
  }

  return db.query.orders.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    with: {
      items: true,
      shipments: { orderBy: asc(schema.orderShipments.packageNumber) },
      statusHistory: { orderBy: desc(schema.orderStatusHistory.createdAt) },
    },
    orderBy: desc(schema.orders.createdAt),
    limit,
    offset,
  });
}
