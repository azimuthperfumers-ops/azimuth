import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { protectedProcedure } from "../middleware/auth.middleware";
import { router } from "../trpc";
import { createWalletRepository } from "../repositories/wallet.repository";
import { createRazorpayService } from "../services/razorpay.service";

// Minimum wallet top-up. Kept here (and echoed to the client) so the rule has
// one source of truth.
export const MIN_TOPUP_INR = 500;

function getRazorpay() {
  try {
    return createRazorpayService();
  } catch (e) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: (e as Error).message });
  }
}

export const walletRouter = router({
  // Current balance + the top-up floor (for the UI).
  get: protectedProcedure.query(async ({ ctx }) => {
    const wallet = createWalletRepository(ctx.db);
    const balance = await wallet.getBalance(ctx.session.user.id);
    return { balance, minTopup: MIN_TOPUP_INR };
  }),

  // Full statement — top-ups, order payments, refunds-to-wallet, adjustments.
  transactions: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(50), offset: z.number().int().min(0).default(0) }).optional())
    .query(({ ctx, input }) =>
      createWalletRepository(ctx.db).listTransactions(ctx.session.user.id, {
        limit: input?.limit,
        offset: input?.offset,
      }),
    ),

  // Start a top-up: creates a Razorpay order the client opens in the modal.
  // The wallet is credited by the payment.captured webhook (authoritative) and,
  // for instant UX, by verifyTopup below — both are idempotent per topupId.
  createTopupOrder: protectedProcedure
    .input(z.object({ amountInr: z.number().int().min(MIN_TOPUP_INR).max(100000) }))
    .mutation(async ({ ctx, input }) => {
      const wallet = createWalletRepository(ctx.db);
      await wallet.ensureWallet(ctx.session.user.id);

      const topup = await wallet.createTopup(ctx.session.user.id, input.amountInr);

      const svc = getRazorpay();
      const rzpOrder = await svc.createOrder({
        amountPaise: Math.round(input.amountInr * 100),
        currency: "INR",
        receipt: `topup-${topup.id.slice(0, 8)}`,
        notes: { kind: "wallet_topup", topupId: topup.id, userId: ctx.session.user.id },
      });
      await wallet.setTopupRazorpayOrder(topup.id, rzpOrder.id);

      return {
        topupId: topup.id,
        razorpayOrderId: rzpOrder.id,
        amount: rzpOrder.amount,
        currency: "INR",
        keyId: svc.getKeyId(),
      };
    }),

  // Called after the Razorpay modal succeeds. Verifies the signature and credits
  // the wallet immediately (idempotent — the webhook may also fire).
  verifyTopup: protectedProcedure
    .input(
      z.object({
        topupId: z.string().uuid(),
        razorpayOrderId: z.string(),
        razorpayPaymentId: z.string(),
        razorpaySignature: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const wallet = createWalletRepository(ctx.db);
      const topup = await wallet.findTopupByRazorpayOrder(input.razorpayOrderId);
      if (!topup || topup.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Top-up not found" });
      }
      if (topup.status === "paid") {
        return { balance: await wallet.getBalance(ctx.session.user.id) };
      }

      const svc = getRazorpay();
      const valid = svc.verifyPaymentSignature(input.razorpayOrderId, input.razorpayPaymentId, input.razorpaySignature);
      if (!valid) throw new TRPCError({ code: "FORBIDDEN", message: "Payment signature invalid" });

      await wallet.markTopupPaid(topup.id, input.razorpayPaymentId);
      const { balanceAfter } = await wallet.record({
        userId: topup.userId,
        amount: Number(topup.amount),
        type: "topup",
        refType: "topup",
        refId: topup.id,
        note: `Wallet top-up ₹${Number(topup.amount)}`,
        idempotent: true,
      });

      return { balance: balanceAfter };
    }),
});
