import type { Database } from "@azimuth/db";
import { schema } from "@azimuth/db";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../middleware/auth.middleware";
import { router } from "../trpc";
import { env } from "../env";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function imageUrl(key: string) {
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
      sku: schema.productVariants.sku,
      sellingPrice: schema.productVariants.sellingPrice,
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

  // fetch primary image per product (cart is small, N+1 acceptable)
  return Promise.all(
    rows.map(async (row) => {
      if (!row.productId) return { ...row, imageUrl: null };
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
      return { ...row, imageUrl: img ? imageUrl(img.key) : null };
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
      for (const item of input) {
        await ctx.db
          .insert(schema.cartItems)
          .values({ userId, variantId: item.variantId, quantity: item.quantity, isSaved: false })
          .onConflictDoUpdate({
            target: [schema.cartItems.userId, schema.cartItems.variantId],
            set: { quantity: item.quantity },
          });
      }
    }),
});
