import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";

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

  // Frontend calls after Razorpay modal success — belt-and-suspenders alongside webhooks.
  // Idempotent: if webhook already captured payment, returns success without double-advancing.
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

      // Webhook may have already captured — idempotent success
      if (order.status === "paid") return { success: true };

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

      await ctx.db
        .update(schema.orders)
        .set({ razorpayPaymentId: input.razorpayPaymentId })
        .where(eq(schema.orders.id, input.orderId));

      await ctx.db
        .update(schema.paymentAttempts)
        .set({ gatewayPaymentId: input.razorpayPaymentId, status: "captured" })
        .where(eq(schema.paymentAttempts.gatewayOrderId, input.razorpayOrderId));

      await advanceOrderStatus(
        ctx.db,
        input.orderId,
        "paid",
        ctx.session.user.id,
        `Payment captured via checkout: ${input.razorpayPaymentId}`,
      );

      return { success: true };
    }),

  checkServiceability: publicProcedure
    .input(z.object({ pincode: z.string().length(6) }))
    .query(async ({ input }) => {
      const logistics = createLogisticsService();
      return logistics.checkServiceability(input.pincode);
    }),
});
