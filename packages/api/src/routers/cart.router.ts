import type { Database } from "@azimuth/db";
import { schema } from "@azimuth/db";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../middleware/auth.middleware";
import { router } from "../trpc";
import { env } from "../env";
import { computeEffectivePrice, fetchActiveDiscountMap } from "../utils/pricing";

// ─── Constants ────────────────────────────────────────────────────────────────

// Max total quantity across the active (non-saved) cart. Kept in sync with the
// user/mobile clients. See MAX_CART_QTY in apps/user/src/lib/cart.ts.
export const MAX_CART_QTY = 5;

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Sum of quantities in the active cart, optionally ignoring one variant (the one
// being upserted/updated, so its old qty doesn't double-count).
async function activeCartQty(db: Database, userId: string, excludeVariantId?: string) {
  const rows = await db
    .select({ variantId: schema.cartItems.variantId, quantity: schema.cartItems.quantity })
    .from(schema.cartItems)
    .where(and(eq(schema.cartItems.userId, userId), eq(schema.cartItems.isSaved, false)));
  return rows
    .filter((r) => r.variantId !== excludeVariantId)
    .reduce((sum, r) => sum + r.quantity, 0);
}

function imageUrl(key: string) {
  if (key.startsWith("https://") || key.startsWith("http://")) return key;
  const base = env.R2_PUBLIC_URL?.replace(/\/$/, "") ?? "";
  return `${base}/${key}`;
}

// ─── Shared query ─────────────────────────────────────────────────────────────

async function fetchCartRows(db: Database, userId: string) {
  const rows = await db
    .select({
      id: schema.cartItems.id,
      variantId: schema.cartItems.variantId,
      quantity: schema.cartItems.quantity,
      isSaved: schema.cartItems.isSaved,
      addedAt: schema.cartItems.addedAt,
      sizeMl: schema.productVariants.sizeMl,
      concentration: schema.productVariants.concentration,
      sku: schema.productVariants.sku,
      mrp: schema.productVariants.mrp,
      stockCached: schema.productVariants.stockCached,
      productId: schema.products.id,
      productName: schema.products.name,
      slug: schema.products.slug,
      themeColor: schema.products.themeColor,
    })
    .from(schema.cartItems)
    .leftJoin(schema.productVariants, eq(schema.cartItems.variantId, schema.productVariants.id))
    .leftJoin(schema.products, eq(schema.productVariants.productId, schema.products.id))
    .where(eq(schema.cartItems.userId, userId))
    .orderBy(schema.cartItems.addedAt);

  const variantIds = rows.map((r) => r.variantId).filter((id): id is string => id != null);
  const discountMap = await fetchActiveDiscountMap(db, variantIds);

  // fetch primary image per product (cart is small, N+1 acceptable)
  return Promise.all(
    rows.map(async (row) => {
      const mrpNum = Number(row.mrp ?? 0);
      const effectivePrice = computeEffectivePrice(mrpNum, row.variantId ? discountMap.get(row.variantId) : undefined);
      if (!row.productId) return { ...row, imageUrl: null, effectivePrice };
      const [img] = await db
        .select({ key: schema.productImages.key })
        .from(schema.productImages)
        .where(
          and(
            eq(schema.productImages.productId, row.productId),
            eq(schema.productImages.isPrimary, true),
          ),
        )
        .limit(1);
      return { ...row, imageUrl: img ? imageUrl(img.key) : null, effectivePrice };
    }),
  );
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const cartRouter = router({
  list: protectedProcedure.query(({ ctx }) =>
    fetchCartRows(ctx.db, ctx.session.user.id),
  ),

  upsert: protectedProcedure
    .input(
      z.object({
        variantId: z.string().uuid(),
        quantity: z.number().int().min(1).default(1),
        isSaved: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Cap total active-cart quantity (saved-for-later items don't count).
      if (!input.isSaved) {
        const others = await activeCartQty(ctx.db, ctx.session.user.id, input.variantId);
        if (others + input.quantity > MAX_CART_QTY) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Cart limit is ${MAX_CART_QTY} items. Remove something to add more.`,
          });
        }
      }
      await ctx.db
        .insert(schema.cartItems)
        .values({
          userId: ctx.session.user.id,
          variantId: input.variantId,
          quantity: input.quantity,
          isSaved: input.isSaved,
        })
        .onConflictDoUpdate({
          target: [schema.cartItems.userId, schema.cartItems.variantId],
          set: { quantity: input.quantity, isSaved: input.isSaved },
        });
    }),

  updateQty: protectedProcedure
    .input(z.object({ variantId: z.string().uuid(), quantity: z.number().int().min(0) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      if (input.quantity === 0) {
        await ctx.db
          .delete(schema.cartItems)
          .where(and(eq(schema.cartItems.userId, userId), eq(schema.cartItems.variantId, input.variantId)));
      } else {
        const others = await activeCartQty(ctx.db, userId, input.variantId);
        if (others + input.quantity > MAX_CART_QTY) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Cart limit is ${MAX_CART_QTY} items.`,
          });
        }
        await ctx.db
          .update(schema.cartItems)
          .set({ quantity: input.quantity })
          .where(and(eq(schema.cartItems.userId, userId), eq(schema.cartItems.variantId, input.variantId)));
      }
    }),

  remove: protectedProcedure
    .input(z.object({ variantId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(schema.cartItems)
        .where(
          and(
            eq(schema.cartItems.userId, ctx.session.user.id),
            eq(schema.cartItems.variantId, input.variantId),
          ),
        );
    }),

  clear: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db
      .delete(schema.cartItems)
      .where(
        and(
          eq(schema.cartItems.userId, ctx.session.user.id),
          eq(schema.cartItems.isSaved, false),
        ),
      );
  }),

  saveForLater: protectedProcedure
    .input(z.object({ variantId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(schema.cartItems)
        .set({ isSaved: true })
        .where(
          and(
            eq(schema.cartItems.userId, ctx.session.user.id),
            eq(schema.cartItems.variantId, input.variantId),
          ),
        );
    }),

  moveToCart: protectedProcedure
    .input(z.object({ variantId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(schema.cartItems)
        .set({ isSaved: false })
        .where(
          and(
            eq(schema.cartItems.userId, ctx.session.user.id),
            eq(schema.cartItems.variantId, input.variantId),
          ),
        );
    }),

  removeSaved: protectedProcedure
    .input(z.object({ variantId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(schema.cartItems)
        .where(
          and(
            eq(schema.cartItems.userId, ctx.session.user.id),
            eq(schema.cartItems.variantId, input.variantId),
          ),
        );
    }),

  // Called on sign-in to merge guest localStorage cart into server cart
  merge: protectedProcedure
    .input(
      z.array(z.object({ variantId: z.string().uuid(), quantity: z.number().int().min(1) })),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      // Clamp merged total to the cap (don't throw — must not block sign-in).
      let running = await activeCartQty(ctx.db, userId);
      for (const item of input) {
        if (running >= MAX_CART_QTY) break;
        const qty = Math.min(item.quantity, MAX_CART_QTY - running);
        running += qty;
        await ctx.db
          .insert(schema.cartItems)
          .values({ userId, variantId: item.variantId, quantity: qty, isSaved: false })
          .onConflictDoUpdate({
            target: [schema.cartItems.userId, schema.cartItems.variantId],
            set: { quantity: qty },
          });
      }
    }),
});
