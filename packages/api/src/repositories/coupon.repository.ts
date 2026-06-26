import type { Database } from "@azimuth/db";
import { schema } from "@azimuth/db";
import { and, asc, count, desc, eq, gt, isNull, lte, or, sql } from "drizzle-orm";

import type { CreateCouponInput, ListCouponsInput, RecordCouponUsageInput, UpdateCouponInput } from "../schemas/coupon.schema";

export function createCouponRepository(db: Database) {
  return {
    async listCoupons(filters: ListCouponsInput) {
      return db.query.coupons.findMany({
        where: filters.isActive !== undefined ? eq(schema.coupons.isActive, filters.isActive) : undefined,
        orderBy: desc(schema.coupons.createdAt),
      });
    },

    async getCouponByCode(code: string) {
      return db.query.coupons.findFirst({
        where: eq(schema.coupons.code, code.toUpperCase()),
      });
    },

    async countUsageByUser(couponId: string, userId: string): Promise<number> {
      const [row] = await db
        .select({ n: sql<number>`cast(count(*) as int)` })
        .from(schema.couponUsages)
        .where(
          and(
            eq(schema.couponUsages.couponId, couponId),
            eq(schema.couponUsages.userId, userId),
          ),
        );
      return row?.n ?? 0;
    },

    async createCoupon(input: CreateCouponInput) {
      const [row] = await db
        .insert(schema.coupons)
        .values({
          ...input,
          code: input.code.toUpperCase(),
          value: input.value.toString(),
          minCartValue: input.minCartValue.toString(),
          maxDiscount: input.maxDiscount?.toString(),
        })
        .returning();
      return row!;
    },

    async updateCoupon(input: UpdateCouponInput) {
      const { id, value, minCartValue, maxDiscount, ...rest } = input;
      const [row] = await db
        .update(schema.coupons)
        .set({
          ...rest,
          ...(value !== undefined ? { value: value.toString() } : {}),
          ...(minCartValue !== undefined ? { minCartValue: minCartValue.toString() } : {}),
          ...(maxDiscount !== undefined ? { maxDiscount: maxDiscount.toString() } : {}),
        })
        .where(eq(schema.coupons.id, id))
        .returning();
      return row;
    },

    async deleteCoupon(id: string) {
      await db.delete(schema.coupons).where(eq(schema.coupons.id, id));
    },

    async listActive() {
      const now = new Date();
      return db.query.coupons.findMany({
        where: and(
          eq(schema.coupons.isActive, true),
          lte(schema.coupons.startsAt, now),
          or(isNull(schema.coupons.endsAt), gt(schema.coupons.endsAt, now)),
        ),
        columns: {
          id: true,
          code: true,
          description: true,
          type: true,
          value: true,
          minCartValue: true,
          maxDiscount: true,
          endsAt: true,
        },
        orderBy: asc(schema.coupons.minCartValue),
      });
    },

    async recordUsage(input: RecordCouponUsageInput) {
      await db.transaction(async (tx) => {
        await tx.insert(schema.couponUsages).values({
          couponId: input.couponId,
          userId: input.userId,
          orderId: input.orderId,
        });
        await tx
          .update(schema.coupons)
          .set({ usedCount: sql`${schema.coupons.usedCount} + 1` })
          .where(eq(schema.coupons.id, input.couponId));
      });
    },
  };
}

export type CouponRepository = ReturnType<typeof createCouponRepository>;
