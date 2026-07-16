import { adminProcedure, protectedProcedure } from "../middleware/auth.middleware";
import { publicProcedure } from "../trpc";
import {
  createCouponSchema,
  deleteCouponSchema,
  listCouponsSchema,
  recordCouponUsageSchema,
  updateCouponSchema,
  validateCouponSchema,
} from "../schemas/coupon.schema";
import { createCouponService } from "../services/coupon.service";
import { router } from "../trpc";

export const couponRouter = router({
  list: adminProcedure
    .input(listCouponsSchema)
    .query(({ ctx, input }) => createCouponService(ctx.db).listCoupons(input)),

  create: adminProcedure
    .input(createCouponSchema)
    .mutation(({ ctx, input }) => createCouponService(ctx.db).createCoupon(input)),

  update: adminProcedure
    .input(updateCouponSchema)
    .mutation(({ ctx, input }) => createCouponService(ctx.db).updateCoupon(input)),

  delete: adminProcedure
    .input(deleteCouponSchema)
    .mutation(({ ctx, input }) => createCouponService(ctx.db).deleteCoupon(input)),

  // Returns active coupons filtered by user's per-coupon usage limit
  listActive: protectedProcedure
    .query(({ ctx }) => createCouponService(ctx.db).listActive(ctx.session.user.id)),

  // Public — offers shown on product pages (no per-user filtering; signed-out
  // visitors see them too). Only live, non-exhausted coupons.
  listPublic: publicProcedure.query(({ ctx }) => createCouponService(ctx.db).listActive()),

  // Public — called from user checkout (pass userId for per-user check)
  validate: publicProcedure
    .input(validateCouponSchema)
    .query(({ ctx, input }) => createCouponService(ctx.db).validateCoupon(input)),

  // Called after order is placed to record usage + increment usedCount
  recordUsage: protectedProcedure
    .input(recordCouponUsageSchema)
    .mutation(({ ctx, input }) => createCouponService(ctx.db).recordUsage(input)),
});
