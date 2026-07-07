import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { schema } from "@azimuth/db";
import { and, count, eq, gte, inArray, sql, sum } from "drizzle-orm";
import { computeEffectivePrice, fetchActiveDiscountMap } from "../utils/pricing";
import { createCouponService } from "../services/coupon.service";
import {
  alertAdminNewOrder,
  notifyOrderPlaced,
  notifyRefundInitiated,
  type CustomerContact,
  type OrderInfo,
} from "@azimuth/comms";

import { adminProcedure, protectedProcedure } from "../middleware/auth.middleware";
import { createLogisticsService } from "../services/logistics.service";
import { orderQueue } from "../lib/order-queue";
import {
  advanceOrderStatus,
  createOrder,
  getAllOrders,
  getOrderById,
  getOrderByNumber,
  getUserOrders,
} from "../repositories/order.repository";
import { router } from "../trpc";

// ── Notification helpers ──────────────────────────────────────────────────────

type OrderRow = typeof schema.orders.$inferSelect;
interface ShippingAddr { fullName?: string; phone?: string; }

async function getOrderContact(db: Parameters<typeof advanceOrderStatus>[0], order: OrderRow): Promise<CustomerContact> {
  const addr = order.shippingAddress as ShippingAddr;
  const user = await db.query.user.findFirst({
    where: eq(schema.user.id, order.userId),
    columns: { email: true, name: true, phone: true, phoneNumber: true },
  });
  return {
    name: addr.fullName ?? user?.name ?? "Customer",
    email: user?.email ?? undefined,
    phone: addr.phone ?? user?.phone ?? user?.phoneNumber ?? undefined,
  };
}

function toOrderInfo(order: OrderRow): OrderInfo {
  return {
    orderNumber: order.orderNumber,
    totalInr: new Intl.NumberFormat("en-IN", {
      style: "currency", currency: "INR", maximumFractionDigits: 0,
    }).format(Number(order.total)),
    waybill: order.delhiveryWaybill ?? undefined,
    trackingUrl: order.trackingUrl ?? undefined,
  };
}

const addressSchema = z.object({
  fullName: z.string().min(1),
  phone: z.string().min(10),
  line1: z.string().min(1),
  line2: z.string().optional().nullable(),
  city: z.string().min(1),
  state: z.string().min(1),
  pincode: z.string().length(6),
  label: z.string().optional(),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
});

const checkoutItemSchema = z.object({
  variantId: z.string().uuid(),
  productName: z.string(),
  variantSku: z.string(),
  sizeMl: z.number().int().positive(),
  unitPrice: z.number().positive(),
  mrp: z.number().positive(),
  quantity: z.number().int().min(1),
  imageUrl: z.string().url().optional().nullable(),
});

const ORDER_STATUS_VALUES = [
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
  "refunded",
  "rto_initiated",
  "rto_delivered",
  "return_requested",
  "return_approved",
  "exchange_requested",
] as const;

export const orderRouter = router({
  // ── User: place order ────────────────────────────────────────────────────────

  create: protectedProcedure
    .input(
      z.object({
        shippingAddress: addressSchema,
        items: z.array(checkoutItemSchema).min(1),
        subtotal: z.number().nonnegative(),
        discountAmount: z.number().nonnegative().default(0),
        shippingCharge: z.number().nonnegative().default(0),
        taxAmount: z.number().nonnegative().default(0),
        total: z.number().positive(),
        couponId: z.string().uuid().optional().nullable(),
        couponCode: z.string().optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Re-verify prices server-side — never trust client unitPrice
      const variantIds = input.items.map((i) => i.variantId);
      const variantRows = await ctx.db
        .select({ id: schema.productVariants.id, mrp: schema.productVariants.mrp })
        .from(schema.productVariants)
        .where(inArray(schema.productVariants.id, variantIds));

      const mrpMap = new Map(variantRows.map((v) => [v.id, Number(v.mrp)]));
      const discountMap = await fetchActiveDiscountMap(ctx.db, variantIds);

      const serverItems = input.items.map((item) => {
        const mrp = mrpMap.get(item.variantId);
        if (!mrp) throw new TRPCError({ code: "BAD_REQUEST", message: `Variant ${item.variantId} not found` });
        const effectivePrice = computeEffectivePrice(mrp, discountMap.get(item.variantId));
        if (Math.abs(item.unitPrice - effectivePrice) > 0.5) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Price mismatch — please refresh and retry" });
        }
        return { ...item, unitPrice: effectivePrice, mrp };
      });

      const serverSubtotal = serverItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);

      // Re-validate coupon server-side — never trust client discountAmount
      let serverDiscountAmount = 0;
      if (input.couponCode) {
        const validation = await createCouponService(ctx.db).validateCoupon({
          code: input.couponCode,
          cartTotal: serverSubtotal,
          userId: ctx.session.user.id,
        });
        serverDiscountAmount = validation.discountAmount;
      }

      const serverTotal = Math.max(0, serverSubtotal - serverDiscountAmount) + input.shippingCharge + input.taxAmount;

      return createOrder(ctx.db, {
        ...input,
        items: serverItems,
        subtotal: serverSubtotal,
        discountAmount: serverDiscountAmount,
        total: serverTotal,
        userId: ctx.session.user.id,
      });
    }),

  // ── User: list own orders ────────────────────────────────────────────────────

  list: protectedProcedure.query(({ ctx }) =>
    getUserOrders(ctx.db, ctx.session.user.id),
  ),

  // ── User: get single order ───────────────────────────────────────────────────

  get: protectedProcedure
    .input(z.object({ orderId: z.string().uuid() }))
    .query(({ ctx, input }) =>
      getOrderById(ctx.db, input.orderId, ctx.session.user.id),
    ),

  getByNumber: protectedProcedure
    .input(z.object({ orderNumber: z.string() }))
    .query(({ ctx, input }) =>
      getOrderByNumber(ctx.db, input.orderNumber, ctx.session.user.id),
    ),

  // ── User: estimate shipping cost (Shiprocket rate API) ──────────────────────

  estimateShipping: protectedProcedure
    .input(
      z.object({
        pincode: z.string().length(6),
        subtotal: z.number().nonnegative(),
        items: z.array(z.object({
          variantId: z.string().uuid(),
          sizeMl: z.number().int().positive(),
          quantity: z.number().int().min(1),
        })),
      }),
    )
    .query(async ({ ctx, input }) => {
      const settings = await ctx.db.query.siteSettings.findFirst();
      const threshold = Number(settings?.freeShippingAboveInr ?? 999);
      if (input.subtotal >= threshold) {
        return { available: true, chargeInr: 0, estimatedDays: null, isFree: true };
      }

      // Look up actual variant weights from DB — same data booking uses, so estimate matches charge
      const variantIds = input.items.map((i) => i.variantId);
      const variants = await ctx.db
        .select({ id: schema.productVariants.id, weightGrams: schema.productVariants.weightGrams })
        .from(schema.productVariants)
        .where(inArray(schema.productVariants.id, variantIds));
      const weightMap = new Map(variants.map((v) => [v.id, v.weightGrams]));

      const totalGrams = input.items.reduce((sum, i) => {
        const dbWeight = weightMap.get(i.variantId);
        // Use DB weight if set; fall back to volumetric formula
        const itemWeight = dbWeight != null ? Number(dbWeight) : (i.sizeMl + 300);
        return sum + itemWeight * i.quantity;
      }, 0);

      // Match booking: +100g packaging buffer, minimum 500g
      const weightGrams = Math.max(500, totalGrams + 100);

      const logistics = createLogisticsService();
      const rate = await logistics.getShippingRate(input.pincode, weightGrams);
      return { ...rate, isFree: false };
    }),

  // ── Admin: list all orders ───────────────────────────────────────────────────

  adminList: adminProcedure
    .input(
      z.object({
        status: z.enum(ORDER_STATUS_VALUES).optional(),
        search: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        limit: z.number().int().min(1).max(200).default(50),
        offset: z.number().int().nonnegative().default(0),
      }),
    )
    .query(({ ctx, input }) => getAllOrders(ctx.db, input)),

  // ── Admin: dashboard stats (DB-aggregated, React Query caches 5min) ──────────

  adminStats: adminProcedure.query(async ({ ctx }) => {
    const db = ctx.db;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Status breakdown — count + revenue per status in one pass
    const breakdown = await db
      .select({
        status: schema.orders.status,
        orderCount: count(),
        revenue: sum(schema.orders.total),
      })
      .from(schema.orders)
      .groupBy(schema.orders.status);

    // Today's confirmed revenue
    const CONFIRMED = ["paid","processing","picked_up","shipped","out_for_delivery","delivery_attempted","delivered","rto_initiated","rto_delivered"];
    const todayRevenue = await db
      .select({ revenue: sum(schema.orders.total) })
      .from(schema.orders)
      .where(
        and(
          gte(schema.orders.createdAt, startOfToday),
          sql`${schema.orders.status} = ANY(ARRAY[${sql.raw(CONFIRMED.map((s) => `'${s}'`).join(","))}]::order_status[])`,
        ),
      );

    const mtdRevenue = await db
      .select({ revenue: sum(schema.orders.total) })
      .from(schema.orders)
      .where(
        and(
          gte(schema.orders.createdAt, startOfMonth),
          sql`${schema.orders.status} = ANY(ARRAY[${sql.raw(CONFIRMED.map((s) => `'${s}'`).join(","))}]::order_status[])`,
        ),
      );

    const todayOrders = await db
      .select({ orderCount: count() })
      .from(schema.orders)
      .where(gte(schema.orders.createdAt, startOfToday));

    return {
      breakdown: breakdown.map((r) => ({
        status: r.status,
        count: Number(r.orderCount),
        revenue: Number(r.revenue ?? 0),
      })),
      todayRevenue: Number(todayRevenue[0]?.revenue ?? 0),
      mtdRevenue: Number(mtdRevenue[0]?.revenue ?? 0),
      todayOrderCount: Number(todayOrders[0]?.orderCount ?? 0),
    };
  }),

  adminGet: adminProcedure
    .input(z.object({ orderId: z.string().uuid() }))
    .query(({ ctx, input }) => getOrderById(ctx.db, input.orderId)),

  // ── Admin: advance status ────────────────────────────────────────────────────

  updateStatus: adminProcedure
    .input(
      z.object({
        orderId: z.string().uuid(),
        status: z.enum(ORDER_STATUS_VALUES),
        note: z.string().optional(),
        waybill: z.string().optional(),
        trackingUrl: z.string().url().optional(),
        gstInvoiceNumber: z.string().optional(),
        shippingCostActual: z.number().positive().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const adminId = ctx.session.user.id;

      const currentOrder = await ctx.db.query.orders.findFirst({
        where: eq(schema.orders.id, input.orderId),
      });
      if (!currentOrder) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });

      const PAID_STATUSES = ["paid", "processing", "picked_up", "shipped", "out_for_delivery", "delivery_attempted", "return_requested", "return_approved"];

      if (
        input.status === "cancelled" &&
        currentOrder.razorpayPaymentId &&
        PAID_STATUSES.includes(currentOrder.status)
      ) {
        const refundPayload = {
          type: "initiate_refund" as const,
          orderId: input.orderId,
          razorpayPaymentId: currentOrder.razorpayPaymentId,
          amountPaise: Math.round(Number(currentOrder.total) * 100),
          reason: input.note ?? "Admin cancelled order",
        };
        const [refundJob] = await ctx.db
          .insert(schema.backgroundJobs)
          .values({ type: "initiate_refund", status: "pending", payload: refundPayload, orderId: input.orderId })
          .returning({ id: schema.backgroundJobs.id });
        const refundBullJob = await orderQueue.add("initiate_refund", { ...refundPayload, dbJobId: refundJob?.id });
        if (refundJob) {
          await ctx.db.update(schema.backgroundJobs).set({ bullmqJobId: refundBullJob.id?.toString() }).where(eq(schema.backgroundJobs.id, refundJob.id));
        }

        if (currentOrder.delhiveryWaybill) {
          const cancelPayload = {
            type: "cancel_shipment" as const,
            orderId: input.orderId,
            waybill: currentOrder.delhiveryWaybill,
          };
          const [cancelJob] = await ctx.db
            .insert(schema.backgroundJobs)
            .values({ type: "cancel_shipment", status: "pending", payload: cancelPayload, orderId: input.orderId })
            .returning({ id: schema.backgroundJobs.id });
          const cancelBullJob = await orderQueue.add("cancel_shipment", { ...cancelPayload, dbJobId: cancelJob?.id });
          if (cancelJob) {
            await ctx.db.update(schema.backgroundJobs).set({ bullmqJobId: cancelBullJob.id?.toString() }).where(eq(schema.backgroundJobs.id, cancelJob.id));
          }
        }
      }

      // Return arrived at warehouse → refund now
      if (
        input.status === "rto_delivered" &&
        currentOrder.razorpayPaymentId &&
        !["refund_processing", "refunded"].includes(currentOrder.status)
      ) {
        const refundPayload = {
          type: "initiate_refund" as const,
          orderId: input.orderId,
          razorpayPaymentId: currentOrder.razorpayPaymentId,
          amountPaise: Math.round(Number(currentOrder.total) * 100),
          reason: input.note ?? "Return received at warehouse",
        };
        const [refundJob] = await ctx.db
          .insert(schema.backgroundJobs)
          .values({ type: "initiate_refund", status: "pending", payload: refundPayload, orderId: input.orderId })
          .returning({ id: schema.backgroundJobs.id });
        const refundBullJob = await orderQueue.add("initiate_refund", { ...refundPayload, dbJobId: refundJob?.id });
        if (refundJob) {
          await ctx.db.update(schema.backgroundJobs).set({ bullmqJobId: refundBullJob.id?.toString() }).where(eq(schema.backgroundJobs.id, refundJob.id));
        }
      }

      if (input.waybill || input.trackingUrl || input.gstInvoiceNumber || input.shippingCostActual) {
        const update: Record<string, string> = {};
        if (input.waybill) update.delhiveryWaybill = input.waybill;
        if (input.trackingUrl) update.trackingUrl = input.trackingUrl;
        if (input.gstInvoiceNumber) update.gstInvoiceNumber = input.gstInvoiceNumber;
        if (input.shippingCostActual) update.shippingCostActual = String(input.shippingCostActual);
        await ctx.db
          .update(schema.orders)
          .set(update)
          .where(eq(schema.orders.id, input.orderId));
      }

      const result = await advanceOrderStatus(ctx.db, input.orderId, input.status, adminId, input.note);

      // Fire-and-forget notifications for status changes that originate from admin
      const order = await ctx.db.query.orders.findFirst({ where: eq(schema.orders.id, input.orderId) });
      if (order) {
        const contact = await getOrderContact(ctx.db, order);
        const info = toOrderInfo(order);
        if (input.status === "refunded") {
          notifyRefundInitiated(contact, info)
            .catch((e: unknown) => console.error("[comms] refund notify:", e));
        }
      }

      return result;
    }),

  // ── Admin: manually retry shipment booking after all queue attempts exhausted ──

  retryShipmentBooking: adminProcedure
    .input(z.object({ orderId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const order = await ctx.db.query.orders.findFirst({
        where: eq(schema.orders.id, input.orderId),
      });

      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      if (order.delhiveryWaybill) throw new TRPCError({ code: "BAD_REQUEST", message: "Order already has a waybill" });

      const TERMINAL = ["delivered", "cancelled", "refunded", "rto_delivered"];
      if (TERMINAL.includes(order.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Cannot retry shipment for ${order.status} order` });
      }

      const bookPayload = { type: "book_shipment" as const, orderId: input.orderId };
      const [bookJob] = await ctx.db
        .insert(schema.backgroundJobs)
        .values({ type: "book_shipment", status: "pending", payload: bookPayload, orderId: input.orderId })
        .returning({ id: schema.backgroundJobs.id });
      const bookBullJob = await orderQueue.add("book_shipment", { ...bookPayload, dbJobId: bookJob?.id });
      if (bookJob) {
        await ctx.db.update(schema.backgroundJobs).set({ bullmqJobId: bookBullJob.id?.toString() }).where(eq(schema.backgroundJobs.id, bookJob.id));
      }

      await advanceOrderStatus(
        ctx.db,
        input.orderId,
        "processing",
        ctx.session.user.id,
        "Shipment booking manually re-queued by admin",
      );

      return { queued: true };
    }),

  // ── Admin: manually mark order as paid when webhook was missed ───────────────
  // Mirrors the payment_captured webhook flow: paid → processing → notifications → book_shipment.
  // If razorpayPaymentId is already on the order, refunds work normally later.
  // If not, admin handles refunds manually for this order.

  confirmPayment: adminProcedure
    .input(z.object({ orderId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const order = await ctx.db.query.orders.findFirst({
        where: eq(schema.orders.id, input.orderId),
      });
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      if (order.status !== "pending_payment" && order.status !== "payment_failed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Order is already ${order.status}` });
      }

      // Advance paid → processing (same as worker processPaymentCaptured)
      await advanceOrderStatus(ctx.db, input.orderId, "paid", ctx.session.user.id, "Manually marked paid by admin");
      await advanceOrderStatus(ctx.db, input.orderId, "processing", ctx.session.user.id, "Shipment booking queued");

      // Send order notifications
      const updatedOrder = await ctx.db.query.orders.findFirst({ where: eq(schema.orders.id, input.orderId) });
      if (updatedOrder) {
        const contact = await getOrderContact(ctx.db, updatedOrder);
        const info = toOrderInfo(updatedOrder);
        Promise.all([notifyOrderPlaced(contact, info), alertAdminNewOrder(info)])
          .catch((e: unknown) => console.error("[order] confirmPayment notify:", e));
      }

      // Queue book_shipment
      const bookPayload = { type: "book_shipment" as const, orderId: input.orderId };
      const [bookJob] = await ctx.db
        .insert(schema.backgroundJobs)
        .values({ type: "book_shipment", status: "pending", payload: bookPayload, orderId: input.orderId })
        .returning({ id: schema.backgroundJobs.id });
      const bullJob = await orderQueue.add("book_shipment", { ...bookPayload, dbJobId: bookJob?.id });
      if (bookJob) {
        await ctx.db.update(schema.backgroundJobs)
          .set({ bullmqJobId: bullJob.id?.toString() })
          .where(eq(schema.backgroundJobs.id, bookJob.id))
          .catch(() => {});
      }

      return { ok: true };
    }),

  // ── Admin: direct refund (no return — e.g. damaged product) ─────────────────

  issueRefund: adminProcedure
    .input(z.object({ orderId: z.string().uuid(), note: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const order = await ctx.db.query.orders.findFirst({
        where: eq(schema.orders.id, input.orderId),
      });
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      if (!order.razorpayPaymentId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No Razorpay payment on this order — refund manually via dashboard" });
      }
      const BLOCKED = ["refund_processing", "refunded", "cancelled"];
      if (BLOCKED.includes(order.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Cannot refund: order is already ${order.status}` });
      }

      const refundPayload = {
        type: "initiate_refund" as const,
        orderId: input.orderId,
        razorpayPaymentId: order.razorpayPaymentId,
        amountPaise: Math.round(Number(order.total) * 100),
        reason: input.note ?? "Direct refund by admin",
      };
      const [refundJob] = await ctx.db
        .insert(schema.backgroundJobs)
        .values({ type: "initiate_refund", status: "pending", payload: refundPayload, orderId: input.orderId })
        .returning({ id: schema.backgroundJobs.id });
      const refundBullJob = await orderQueue.add("initiate_refund", { ...refundPayload, dbJobId: refundJob?.id });
      if (refundJob) {
        await ctx.db.update(schema.backgroundJobs).set({ bullmqJobId: refundBullJob.id?.toString() }).where(eq(schema.backgroundJobs.id, refundJob.id));
      }

      await advanceOrderStatus(ctx.db, input.orderId, "refund_processing", ctx.session.user.id, input.note ?? "Direct refund initiated by admin");
      return { ok: true };
    }),

});
