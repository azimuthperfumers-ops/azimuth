import crypto from "crypto";

import Razorpay from "razorpay";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";

import { schema } from "@azimuth/db";
import { protectedProcedure } from "../middleware/auth.middleware";
import { advanceOrderStatus } from "../repositories/order.repository";
import { createDelhiveryService } from "../services/delhivery.service";
import { publicProcedure, router } from "../trpc";

function razorpayInstance() {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;

  if (!key_id || !key_secret) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.",
    });
  }

  return new Razorpay({ key_id, key_secret });
}

export const paymentRouter = router({
  // Called after order.create — creates Razorpay order and records payment attempt
  createRazorpayOrder: protectedProcedure
    .input(z.object({ orderId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const order = await ctx.db.query.orders.findFirst({
        where: and(
          eq(schema.orders.id, input.orderId),
          eq(schema.orders.userId, ctx.session.user.id),
        ),
      });

      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      }

      if (order.status !== "pending_payment") {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Order is already in status '${order.status}'`,
        });
      }

      const amountPaise = Math.round(Number(order.total) * 100);

      const rzp = razorpayInstance();
      const rzpOrder = await rzp.orders.create({
        amount: amountPaise,
        currency: "INR",
        receipt: order.orderNumber,
        notes: { orderId: order.id },
      });

      // Store razorpayOrderId on the order row
      await ctx.db
        .update(schema.orders)
        .set({ razorpayOrderId: rzpOrder.id })
        .where(eq(schema.orders.id, order.id));

      // Append-only payment attempt record
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
        keyId: process.env.RAZORPAY_KEY_ID!,
        orderNumber: order.orderNumber,
      };
    }),

  // Called by frontend after Razorpay checkout succeeds — verifies HMAC then marks paid
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
      const keySecret = process.env.RAZORPAY_KEY_SECRET;
      if (!keySecret) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Razorpay not configured",
        });
      }

      // HMAC-SHA256 verification — Razorpay spec: sign(orderId|paymentId)
      const body = `${input.razorpayOrderId}|${input.razorpayPaymentId}`;
      const expected = crypto
        .createHmac("sha256", keySecret)
        .update(body)
        .digest("hex");

      if (expected !== input.razorpaySignature) {
        // Append failed attempt before throwing
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

      // Store payment ID on order
      await ctx.db
        .update(schema.orders)
        .set({ razorpayPaymentId: input.razorpayPaymentId })
        .where(
          and(
            eq(schema.orders.id, input.orderId),
            eq(schema.orders.userId, ctx.session.user.id),
          ),
        );

      // Update payment attempt to captured
      await ctx.db
        .update(schema.paymentAttempts)
        .set({
          gatewayPaymentId: input.razorpayPaymentId,
          status: "captured",
        })
        .where(eq(schema.paymentAttempts.gatewayOrderId, input.razorpayOrderId));

      // Advance order status
      return advanceOrderStatus(
        ctx.db,
        input.orderId,
        "paid",
        ctx.session.user.id,
        `Payment captured: ${input.razorpayPaymentId}`,
      );
    }),

  // Pincode serviceability check (public — used before checkout to warn unserviceable areas)
  checkServiceability: publicProcedure
    .input(z.object({ pincode: z.string().length(6) }))
    .query(async ({ input }) => {
      const delhivery = createDelhiveryService();
      return delhivery.checkServiceability(input.pincode);
    }),
});
