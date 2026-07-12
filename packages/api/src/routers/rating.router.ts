import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, avg, count, eq, inArray } from "drizzle-orm";

import { schema } from "@azimuth/db";
import { adminProcedure, protectedProcedure } from "../middleware/auth.middleware";
import { publicProcedure, router } from "../trpc";

// Ratings are per PRODUCT (not variant) and unlocked only by a delivered order
// containing that product. Storefront display respects the per-product
// rating_display_mode: "mock" shows admin-configured placeholder numbers until
// enough real ratings accumulate; "real" shows the true aggregate.

export const ratingRouter = router({
  // ── User: submit / update rating ────────────────────────────────────────────

  rate: protectedProcedure
    .input(
      z.object({
        productId: z.string().uuid(),
        orderId: z.string().uuid(),
        rating: z.number().int().min(1).max(5),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const order = await ctx.db.query.orders.findFirst({
        where: and(eq(schema.orders.id, input.orderId), eq(schema.orders.userId, userId)),
        with: { items: true },
      });
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      if (order.status !== "delivered") {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "You can rate once the order is delivered" });
      }

      // The order must actually contain a variant of this product
      const variantIds = order.items
        .map((i) => i.variantId)
        .filter((id): id is string => id != null);
      if (variantIds.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Order has no rateable items" });
      }
      const [match] = await ctx.db
        .select({ id: schema.productVariants.id })
        .from(schema.productVariants)
        .where(
          and(
            inArray(schema.productVariants.id, variantIds),
            eq(schema.productVariants.productId, input.productId),
          ),
        )
        .limit(1);
      if (!match) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This product is not part of that order" });
      }

      const [saved] = await ctx.db
        .insert(schema.productRatings)
        .values({
          productId: input.productId,
          userId,
          orderId: input.orderId,
          rating: input.rating,
        })
        .onConflictDoUpdate({
          target: [schema.productRatings.productId, schema.productRatings.userId],
          set: { rating: input.rating, orderId: input.orderId, updatedAt: new Date() },
        })
        .returning();

      return saved;
    }),

  // ── User: rateable products for an order + existing ratings ─────────────────
  // Drives the orders-page star widget: which products this order can rate,
  // and what the user already rated them.

  orderRatings: protectedProcedure
    .input(z.object({ orderId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const order = await ctx.db.query.orders.findFirst({
        where: and(eq(schema.orders.id, input.orderId), eq(schema.orders.userId, userId)),
        with: { items: true },
      });
      if (!order) throw new TRPCError({ code: "NOT_FOUND" });

      const canRate = order.status === "delivered";

      const variantIds = order.items
        .map((i) => i.variantId)
        .filter((id): id is string => id != null);
      if (variantIds.length === 0) return { canRate, products: [] };

      const variants = await ctx.db
        .select({
          variantId: schema.productVariants.id,
          productId: schema.productVariants.productId,
          productName: schema.products.name,
        })
        .from(schema.productVariants)
        .innerJoin(schema.products, eq(schema.productVariants.productId, schema.products.id))
        .where(inArray(schema.productVariants.id, variantIds));

      const productIds = [...new Set(variants.map((v) => v.productId))];
      const mine = productIds.length
        ? await ctx.db
            .select({
              productId: schema.productRatings.productId,
              rating: schema.productRatings.rating,
            })
            .from(schema.productRatings)
            .where(
              and(
                eq(schema.productRatings.userId, userId),
                inArray(schema.productRatings.productId, productIds),
              ),
            )
        : [];
      const mineMap = new Map(mine.map((m) => [m.productId, m.rating]));

      // One entry per product (order may hold two variants of the same perfume)
      const seen = new Set<string>();
      const products = variants
        .filter((v) => (seen.has(v.productId) ? false : (seen.add(v.productId), true)))
        .map((v) => ({
          productId: v.productId,
          productName: v.productName,
          variantId: v.variantId,
          myRating: mineMap.get(v.productId) ?? null,
        }));

      return { canRate, products };
    }),

  // ── User: own ratings for a set of products (orders page shows "rated ★4") ──

  myRatings: protectedProcedure
    .input(z.object({ productIds: z.array(z.string().uuid()).min(1).max(100) }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          productId: schema.productRatings.productId,
          rating: schema.productRatings.rating,
        })
        .from(schema.productRatings)
        .where(
          and(
            eq(schema.productRatings.userId, ctx.session.user.id),
            inArray(schema.productRatings.productId, input.productIds),
          ),
        );
      return Object.fromEntries(rows.map((r) => [r.productId, r.rating]));
    }),

  // ── Public: display ratings for products (mock/real aware) ──────────────────

  forProducts: publicProcedure
    .input(z.object({ productIds: z.array(z.string().uuid()).min(1).max(100) }))
    .query(async ({ ctx, input }) => {
      const productRows = await ctx.db
        .select({
          id: schema.products.id,
          mode: schema.products.ratingDisplayMode,
          mockRating: schema.products.mockRating,
          mockRatingCount: schema.products.mockRatingCount,
        })
        .from(schema.products)
        .where(inArray(schema.products.id, input.productIds));

      const realRows = await ctx.db
        .select({
          productId: schema.productRatings.productId,
          avg: avg(schema.productRatings.rating),
          count: count(),
        })
        .from(schema.productRatings)
        .where(inArray(schema.productRatings.productId, input.productIds))
        .groupBy(schema.productRatings.productId);
      const realMap = new Map(realRows.map((r) => [r.productId, r]));

      const result: Record<string, { rating: number; count: number } | null> = {};
      for (const p of productRows) {
        if (p.mode === "mock") {
          result[p.id] = { rating: Number(p.mockRating), count: p.mockRatingCount };
        } else {
          const real = realMap.get(p.id);
          result[p.id] = real
            ? { rating: Math.round(Number(real.avg) * 10) / 10, count: Number(real.count) }
            : null; // real mode, no ratings yet — storefront hides stars
        }
      }
      return result;
    }),

  // ── Admin: real vs mock stats + display-mode switch ─────────────────────────

  adminGetForProduct: adminProcedure
    .input(z.object({ productId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const product = await ctx.db.query.products.findFirst({
        where: eq(schema.products.id, input.productId),
        columns: { ratingDisplayMode: true, mockRating: true, mockRatingCount: true },
      });
      if (!product) throw new TRPCError({ code: "NOT_FOUND" });

      const [real] = await ctx.db
        .select({ avg: avg(schema.productRatings.rating), count: count() })
        .from(schema.productRatings)
        .where(eq(schema.productRatings.productId, input.productId));

      return {
        mode: product.ratingDisplayMode,
        mockRating: Number(product.mockRating),
        mockRatingCount: product.mockRatingCount,
        realRating: real?.avg != null ? Math.round(Number(real.avg) * 10) / 10 : null,
        realCount: Number(real?.count ?? 0),
      };
    }),

  adminSetDisplay: adminProcedure
    .input(
      z.object({
        productId: z.string().uuid(),
        mode: z.enum(["real", "mock"]),
        mockRating: z.number().min(1).max(5).multipleOf(0.1).optional(),
        mockRatingCount: z.number().int().min(0).max(100000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const update: Record<string, unknown> = { ratingDisplayMode: input.mode };
      if (input.mockRating != null) update.mockRating = String(input.mockRating);
      if (input.mockRatingCount != null) update.mockRatingCount = input.mockRatingCount;

      const [updated] = await ctx.db
        .update(schema.products)
        .set(update)
        .where(eq(schema.products.id, input.productId))
        .returning({ id: schema.products.id });
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return { ok: true };
    }),
});
