import type { Database } from "@azimuth/db";
import { TRPCError } from "@trpc/server";

import { createCouponRepository } from "../repositories/coupon.repository";
import type {
  CreateCouponInput,
  DeleteCouponInput,
  ListCouponsInput,
  RecordCouponUsageInput,
  UpdateCouponInput,
  ValidateCouponInput,
} from "../schemas/coupon.schema";

function hasPgErrorCode(err: unknown, code: string): boolean {
  if (typeof err !== "object" || err === null) return false;
  if ("code" in err && err.code === code) return true;
  const cause = (err as { cause?: unknown }).cause;
  return typeof cause === "object" && cause !== null && "code" in cause && cause.code === code;
}

export function createCouponService(db: Database) {
  const repo = createCouponRepository(db);

  return {
    listCoupons(input: ListCouponsInput) {
      return repo.listCoupons(input);
    },

    listActive(userId?: string) {
      return repo.listActive(userId);
    },

    async createCoupon(input: CreateCouponInput) {
      try {
        return await repo.createCoupon(input);
      } catch (err) {
        if (hasPgErrorCode(err, "23505")) {
          throw new TRPCError({ code: "CONFLICT", message: "coupon code already exists" });
        }
        throw err;
      }
    },

    async updateCoupon(input: UpdateCouponInput) {
      try {
        const row = await repo.updateCoupon(input);
        if (!row) throw new TRPCError({ code: "NOT_FOUND" });
        return row;
      } catch (err) {
        if (hasPgErrorCode(err, "23505")) {
          throw new TRPCError({ code: "CONFLICT", message: "coupon code already exists" });
        }
        throw err;
      }
    },

    deleteCoupon(input: DeleteCouponInput) {
      return repo.deleteCoupon(input.id);
    },

    recordUsage(input: RecordCouponUsageInput) {
      return repo.recordUsage(input);
    },

    async validateCoupon(input: ValidateCouponInput) {
      const coupon = await repo.getCouponByCode(input.code);

      if (!coupon) {
        throw new TRPCError({ code: "NOT_FOUND", message: "invalid coupon code" });
      }
      if (!coupon.isActive) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "coupon is inactive" });
      }

      const now = new Date();
      if (coupon.startsAt > now) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "coupon is not yet valid" });
      }
      if (coupon.endsAt && coupon.endsAt < now) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "coupon has expired" });
      }

      // Payment-method lock — coupon may be restricted to wallet or bank/card.
      if (
        input.paymentMethod &&
        coupon.paymentMethod !== "any" &&
        coupon.paymentMethod !== input.paymentMethod
      ) {
        const label = coupon.paymentMethod === "wallet" ? "wallet payments" : "card/bank payments";
        throw new TRPCError({ code: "BAD_REQUEST", message: `This coupon is only valid for ${label}.` });
      }

      const minCart = Number(coupon.minCartValue);
      if (input.cartTotal < minCart) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `minimum cart value for this coupon is ₹${minCart.toFixed(0)}`,
        });
      }

      if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "coupon usage limit reached" });
      }

      // Per-user check — only when userId supplied
      if (input.userId && coupon.usageLimitPerUser !== null) {
        const userUses = await repo.countUsageByUser(coupon.id, input.userId);
        if (userUses >= coupon.usageLimitPerUser!) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `you have already used this coupon ${coupon.usageLimitPerUser} time${coupon.usageLimitPerUser === 1 ? "" : "s"}`,
          });
        }
      }

      const value = Number(coupon.value);
      let discountAmount =
        coupon.type === "percentage" ? (input.cartTotal * value) / 100 : value;

      if (coupon.maxDiscount !== null) {
        discountAmount = Math.min(discountAmount, Number(coupon.maxDiscount));
      }
      discountAmount = Math.min(discountAmount, input.cartTotal);

      return {
        couponId: coupon.id,
        code: coupon.code,
        type: coupon.type,
        value,
        minCartValue: Number(coupon.minCartValue),
        discountAmount: Math.round(discountAmount * 100) / 100,
        finalTotal: Math.round((input.cartTotal - discountAmount) * 100) / 100,
      };
    },
  };
}

export type CouponService = ReturnType<typeof createCouponService>;
