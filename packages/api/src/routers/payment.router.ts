import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";

import { schema } from "@azimuth/db";
import { protectedProcedure } from "../middleware/auth.middleware";
import { advanceOrderStatus } from "../repositories/order.repository";
import { createLogisticsService } from "../services/logistics.service";
import { createRazorpayService } from "../services/razorpay.service";
import { publicProcedure, router } from "../trpc";

function getRazorpay() {
  try {
    return createRazorpayService();
  } catch (e) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: (e as Error).message });
  }
}

export const paymentRouter = router({
  // Server creates a Razorpay order — amount authoritative from DB, never from frontend
  createRazorpayOrder: protectedProcedure
    .input(z.object({ orderId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const order = await ctx.db.query.orders.findFirst({
        where: and(
          eq(schema.orders.id, input.orderId),
          eq(schema.orders.userId, ctx.session.user.id),
        ),
      });

      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });

      if (order.status !== "pending_payment") {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Order already in status '${order.status}'`,
        });
      }

      const amountPaise = Math.round(Number(order.total) * 100);

      const svc = getRazorpay();
      const rzpOrder = await svc.createOrder({
        amountPaise,
        currency: "INR",
        receipt: order.orderNumber,
        orderId: order.id,
      });

      await ctx.db
        .update(schema.orders)
        .set({ razorpayOrderId: rzpOrder.id })
        .where(eq(schema.orders.id, order.id));

      await ctx.db.insert(schema.paymentAttempts).values({
        orderId: order.id,
        gateway: "razorpay",
        gatewayOrderId: rzpOrder.id,
        status: "created",
        amount: order.total,
        rawResponse: rzpOrder as unknown as Record<string, unknown>,
      });

      return {
        razorpayOrderId: rzpOrder.id,
        amount: amountPaise,
        currency: "INR",
        keyId: svc.getKeyId(),
        orderNumber: order.orderNumber,
      };
    }),

  // Frontend calls after Razorpay modal success to validate HMAC signature.
  // Does NOT advance order status — payment.captured webhook is authoritative for paid status.
  // Returns success once signature verified; webhook handles paid → processing → book_shipment.
  verifyAndConfirmPayment: protectedProcedure
    .input(
      z.object({
        orderId: z.string().uuid(),
        razorpayOrderId: z.string(),
        razorpayPaymentId: z.string(),
        razorpaySignature: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const order = await ctx.db.query.orders.findFirst({
        where: and(
          eq(schema.orders.id, input.orderId),
          eq(schema.orders.userId, ctx.session.user.id),
        ),
      });
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });

      // Already processed by webhook — idempotent
      if (order.status !== "pending_payment") return { success: true };

      // The signature only proves razorpayOrderId+PaymentId belong together — it does
      // not prove they belong to THIS order. Reject a payment from a different order.
      if (order.razorpayOrderId !== input.razorpayOrderId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Payment does not belong to this order" });
      }

      const svc = getRazorpay();
      const valid = svc.verifyPaymentSignature(
        input.razorpayOrderId,
        input.razorpayPaymentId,
        input.razorpaySignature,
      );

      if (!valid) {
        await ctx.db.insert(schema.paymentAttempts).values({
          orderId: input.orderId,
          gateway: "razorpay",
          gatewayOrderId: input.razorpayOrderId,
          gatewayPaymentId: input.razorpayPaymentId,
          status: "failed",
          amount: "0",
          rawResponse: { error: "signature_mismatch" },
        });
        throw new TRPCError({ code: "FORBIDDEN", message: "Payment signature invalid" });
      }

      // Store payment ID + mark attempt captured — webhook advances the order status
      await ctx.db
        .update(schema.orders)
        .set({ razorpayPaymentId: input.razorpayPaymentId })
        .where(eq(schema.orders.id, input.orderId));

      await ctx.db
        .update(schema.paymentAttempts)
        .set({ gatewayPaymentId: input.razorpayPaymentId, status: "captured" })
        .where(eq(schema.paymentAttempts.gatewayOrderId, input.razorpayOrderId));

      // Cart is only cleared once payment is actually verified — not at order
      // creation — so a cancelled/failed/interrupted payment leaves the cart intact.
      await ctx.db
        .delete(schema.cartItems)
        .where(
          and(
            eq(schema.cartItems.userId, ctx.session.user.id),
            eq(schema.cartItems.isSaved, false),
          ),
        );

      return { success: true };
    }),

  // User dismissed the Razorpay window without paying. Marks the order
  // payment_failed immediately instead of leaving it pending for the 30-min sweep.
  // No inventory to release — stock is only committed when payment captures.
  markPaymentAbandoned: protectedProcedure
    .input(z.object({ orderId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const order = await ctx.db.query.orders.findFirst({
        where: and(
          eq(schema.orders.id, input.orderId),
          eq(schema.orders.userId, ctx.session.user.id),
        ),
      });
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });

      // Webhook already moved it on — nothing to abandon
      if (order.status !== "pending_payment") return { status: order.status };

      // UPI race: user scans the QR, dismisses the modal, money lands seconds later.
      // Ask Razorpay before failing — never fail an order a payment arrived for.
      if (order.razorpayOrderId) {
        try {
          const payments = await getRazorpay().fetchOrderPayments(order.razorpayOrderId);
          if (payments.some((p) => p.status === "captured" || p.status === "authorized")) {
            return { status: "pending_payment" as const, paymentInFlight: true };
          }
        } catch {
          // Can't verify with Razorpay right now — leave pending, sweep will settle it
          return { status: "pending_payment" as const };
        }
      }

      await advanceOrderStatus(
        ctx.db, order.id, "payment_failed", ctx.session.user.id,
        "Checkout abandoned — Razorpay window dismissed by customer",
      );

      await ctx.db
        .update(schema.paymentAttempts)
        .set({ status: "failed" })
        .where(
          and(
            eq(schema.paymentAttempts.orderId, order.id),
            inArray(schema.paymentAttempts.status, ["created", "authorized"]),
          ),
        );

      return { status: "payment_failed" as const };
    }),

  checkServiceability: publicProcedure
    .input(z.object({ pincode: z.string().length(6) }))
    .query(async ({ input }) => {
      const logistics = createLogisticsService();
      return logistics.checkServiceability(input.pincode);
    }),
});
