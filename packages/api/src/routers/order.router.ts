import { z } from "zod";

import { schema } from "@azimuth/db";
import { eq } from "drizzle-orm";
import {
  alertAdminRefund,
  notifyRefundInitiated,
  notifyShipped,
  type CustomerContact,
  type OrderInfo,
} from "@azimuth/comms";

import { adminProcedure, protectedProcedure } from "../middleware/auth.middleware";
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
    delhiveryWaybill: order.delhiveryWaybill ?? undefined,
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
      return createOrder(ctx.db, { ...input, userId: ctx.session.user.id });
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

  // ── Admin: list all orders ───────────────────────────────────────────────────

  adminList: adminProcedure
    .input(
      z.object({
        status: z.enum(ORDER_STATUS_VALUES).optional(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().nonnegative().default(0),
      }),
    )
    .query(({ ctx, input }) => getAllOrders(ctx.db, input)),

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
        delhiveryWaybill: z.string().optional(),
        trackingUrl: z.string().url().optional(),
        gstInvoiceNumber: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const adminId = ctx.session.user.id;

      if (input.delhiveryWaybill || input.trackingUrl || input.gstInvoiceNumber) {
        const update: Record<string, string> = {};
        if (input.delhiveryWaybill) update.delhiveryWaybill = input.delhiveryWaybill;
        if (input.trackingUrl) update.trackingUrl = input.trackingUrl;
        if (input.gstInvoiceNumber) update.gstInvoiceNumber = input.gstInvoiceNumber;
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
        if (input.status === "shipped") {
          notifyShipped(contact, info).catch((e: unknown) => console.error("[comms] notifyShipped:", e));
        } else if (input.status === "refunded") {
          Promise.all([
            notifyRefundInitiated(contact, info),
            alertAdminRefund(info),
          ]).catch((e: unknown) => console.error("[comms] refund notify:", e));
        }
      }

      return result;
    }),

  // ── Admin: store razorpay IDs after webhook confirms payment ─────────────────

  confirmPayment: adminProcedure
    .input(
      z.object({
        orderId: z.string().uuid(),
        razorpayOrderId: z.string(),
        razorpayPaymentId: z.string(),
        gstInvoiceNumber: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(schema.orders)
        .set({
          razorpayOrderId: input.razorpayOrderId,
          razorpayPaymentId: input.razorpayPaymentId,
          gstInvoiceNumber: input.gstInvoiceNumber ?? null,
        })
        .where(eq(schema.orders.id, input.orderId));

      return advanceOrderStatus(
        ctx.db,
        input.orderId,
        "paid",
        ctx.session.user.id,
        `Payment captured: ${input.razorpayPaymentId}`,
      );
    }),
});
