import { and, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";

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
};

export async function createOrder(db: Database, input: CreateOrderInput) {
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

    // Clear server-side cart
    await tx
      .delete(schema.cartItems)
      .where(
        and(
          eq(schema.cartItems.userId, input.userId),
          eq(schema.cartItems.isSaved, false),
        ),
      );

    return order;
  });
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
  return db.query.orders.findMany({
    where: eq(schema.orders.userId, userId),
    with: { items: true },
    orderBy: desc(schema.orders.createdAt),
  });
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

export async function getOrderById(db: Database, orderId: string, userId?: string) {
  const where = userId
    ? and(eq(schema.orders.id, orderId), eq(schema.orders.userId, userId))
    : eq(schema.orders.id, orderId);

  const order = await db.query.orders.findFirst({
    where,
    with: {
      items: true,
      statusHistory: { orderBy: desc(schema.orderStatusHistory.createdAt) },
      paymentAttempts: { orderBy: desc(schema.paymentAttempts.createdAt) },
    },
  });
  return enrichItemImages(db, order);
}

export async function getOrderByNumber(db: Database, orderNumber: string, userId?: string) {
  const where = userId
    ? and(eq(schema.orders.orderNumber, orderNumber), eq(schema.orders.userId, userId))
    : eq(schema.orders.orderNumber, orderNumber);

  const order = await db.query.orders.findFirst({
    where,
    with: {
      items: true,
      statusHistory: { orderBy: desc(schema.orderStatusHistory.createdAt) },
      paymentAttempts: { orderBy: desc(schema.paymentAttempts.createdAt) },
    },
  });
  return enrichItemImages(db, order);
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
        ilike(schema.orders.delhiveryWaybill, q),
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
      statusHistory: { orderBy: desc(schema.orderStatusHistory.createdAt) },
    },
    orderBy: desc(schema.orders.createdAt),
    limit,
    offset,
  });
}
