import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, count, desc, eq, gte, ilike, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";

import { schema, type Database } from "@azimuth/db";
import { permissionProcedure, protectedProcedure } from "../middleware/auth.middleware";
import { imageUrl } from "../services/catalog.service";
import { router } from "../trpc";

// ── Customer feedback ────────────────────────────────────────────────────────
//
// Two layers, both unlocked only by a DELIVERED order:
//   • order_feedback  — how the delivery/packaging/experience went (one per order)
//   • product_ratings — how the fragrance itself was (one per user per product)
//
// Everything here is PRIVATE. Written comments and reviews are never returned to
// the storefront; only the author and staff holding the `feedback` permission
// can read them. The public product star aggregate lives in rating.router.ts and
// exposes numbers only — never the prose.
//
// Ratings are half-star. They are stored numeric(2,1), which drizzle returns as
// a string, so every read converts with Number() at this boundary and every
// client sees a plain number.

// 1, 1.5, 2 … 5
const halfStar = z.number().min(1).max(5).multipleOf(0.5);

// How far back we keep nudging a customer to rate a delivered order.
const PROMPT_WINDOW_DAYS = 90;

/** numeric(2,1) → number, preserving null. */
function toRating(value: string | null): number | null {
  return value == null ? null : Number(value);
}

/**
 * The moment an order reached `delivered`, read off the append-only status
 * history. Orders carry no deliveredAt column, and updatedAt moves for unrelated
 * edits, so the history is the only honest source.
 */
const deliveredAtSql = sql<Date | null>`(
  SELECT max(h.created_at)
  FROM order_status_history h
  WHERE h.order_id = ${schema.orders.id} AND h.to_status = 'delivered'
)`;

/**
 * Guard shared by every user-facing path: the order must exist, belong to
 * `userId`, and be delivered. Returns the order with its items.
 */
async function loadRateableOrder(db: Database, orderId: string, userId: string) {
  const order = await db.query.orders.findFirst({
    where: and(eq(schema.orders.id, orderId), eq(schema.orders.userId, userId)),
    with: { items: true },
  });
  if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
  if (order.status !== "delivered") {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "You can leave feedback once the order is delivered",
    });
  }
  return order;
}

export const feedbackRouter = router({
  // ── User: which delivered orders still want feedback ───────────────────────
  // Drives the elegant nudge on the account/orders pages. An order drops out of
  // this list once it is rated or the customer dismisses the prompt.

  pending: protectedProcedure.query(async ({ ctx }) => {
    const since = new Date(Date.now() - PROMPT_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const rows = await ctx.db
      .select({
        orderId: schema.orders.id,
        orderNumber: schema.orders.orderNumber,
        deliveredAt: deliveredAtSql,
      })
      .from(schema.orders)
      .leftJoin(schema.orderFeedback, eq(schema.orderFeedback.orderId, schema.orders.id))
      .where(
        and(
          eq(schema.orders.userId, ctx.session.user.id),
          eq(schema.orders.status, "delivered"),
          gte(schema.orders.createdAt, since),
          // No feedback row at all, or one that is neither rated nor dismissed.
          or(
            isNull(schema.orderFeedback.id),
            and(isNull(schema.orderFeedback.rating), isNull(schema.orderFeedback.dismissedAt)),
          ),
        ),
      )
      .orderBy(desc(schema.orders.createdAt))
      .limit(10);

    if (rows.length === 0) return [];

    // One representative product per order, for the thumbnail in the nudge.
    const orderIds = rows.map((r) => r.orderId);
    const items = await ctx.db
      .select({
        orderId: schema.orderItems.orderId,
        productName: schema.orderItems.productName,
        imageKey: schema.productImages.key,
      })
      .from(schema.orderItems)
      .leftJoin(schema.productVariants, eq(schema.orderItems.variantId, schema.productVariants.id))
      .leftJoin(
        schema.productImages,
        and(
          eq(schema.productImages.productId, schema.productVariants.productId),
          eq(schema.productImages.isPrimary, true),
        ),
      )
      .where(inArray(schema.orderItems.orderId, orderIds));

    const byOrder = new Map<string, { productName: string; imageUrl: string | null; count: number }>();
    for (const item of items) {
      const existing = byOrder.get(item.orderId);
      if (existing) existing.count += 1;
      else
        byOrder.set(item.orderId, {
          productName: item.productName,
          imageUrl: item.imageKey ? imageUrl(item.imageKey) : null,
          count: 1,
        });
    }

    return rows.map((r) => ({
      orderId: r.orderId,
      orderNumber: r.orderNumber,
      deliveredAt: r.deliveredAt,
      productName: byOrder.get(r.orderId)?.productName ?? null,
      imageUrl: byOrder.get(r.orderId)?.imageUrl ?? null,
      itemCount: byOrder.get(r.orderId)?.count ?? 0,
    }));
  }),

  // ── User: the feedback form for one order ──────────────────────────────────

  forOrder: protectedProcedure
    .input(z.object({ orderId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const order = await loadRateableOrder(ctx.db, input.orderId, userId);

      const [meta] = await ctx.db
        .select({
          orderNumber: schema.orders.orderNumber,
          deliveredAt: deliveredAtSql,
        })
        .from(schema.orders)
        .where(eq(schema.orders.id, input.orderId));

      const existing = await ctx.db.query.orderFeedback.findFirst({
        where: eq(schema.orderFeedback.orderId, input.orderId),
      });

      // Products in this order, plus whatever the user already said about each.
      const variantIds = order.items
        .map((i) => i.variantId)
        .filter((id): id is string => id != null);

      const products = variantIds.length
        ? await ctx.db
            .select({
              productId: schema.productVariants.productId,
              productName: schema.products.name,
              imageKey: schema.productImages.key,
            })
            .from(schema.productVariants)
            .innerJoin(schema.products, eq(schema.productVariants.productId, schema.products.id))
            .leftJoin(
              schema.productImages,
              and(
                eq(schema.productImages.productId, schema.products.id),
                eq(schema.productImages.isPrimary, true),
              ),
            )
            .where(inArray(schema.productVariants.id, variantIds))
        : [];

      const productIds = [...new Set(products.map((p) => p.productId))];
      const mine = productIds.length
        ? await ctx.db
            .select({
              productId: schema.productRatings.productId,
              rating: schema.productRatings.rating,
              review: schema.productRatings.review,
            })
            .from(schema.productRatings)
            .where(
              and(
                eq(schema.productRatings.userId, userId),
                inArray(schema.productRatings.productId, productIds),
              ),
            )
        : [];
      const mineMap = new Map(mine.map((m) => [m.productId, m]));

      // An order can hold two variants of the same perfume — collapse to one row.
      const seen = new Set<string>();
      const uniqueProducts = products
        .filter((p) => (seen.has(p.productId) ? false : (seen.add(p.productId), true)))
        .map((p) => ({
          productId: p.productId,
          productName: p.productName,
          imageUrl: p.imageKey ? imageUrl(p.imageKey) : null,
          myRating: toRating(mineMap.get(p.productId)?.rating ?? null),
          myReview: mineMap.get(p.productId)?.review ?? null,
        }));

      return {
        orderId: input.orderId,
        orderNumber: meta?.orderNumber ?? "",
        deliveredAt: meta?.deliveredAt ?? null,
        feedback: existing
          ? {
              rating: toRating(existing.rating),
              comment: existing.comment,
              submittedAt: existing.rating != null ? existing.updatedAt : null,
            }
          : null,
        products: uniqueProducts,
      };
    }),

  // ── User: submit / revise feedback ─────────────────────────────────────────
  // Experience rating and per-product reviews travel together so one "Send"
  // writes the whole form.

  submit: protectedProcedure
    .input(
      z.object({
        orderId: z.string().uuid(),
        rating: halfStar,
        comment: z.string().trim().max(2000).optional(),
        products: z
          .array(
            z.object({
              productId: z.string().uuid(),
              rating: halfStar,
              review: z.string().trim().max(2000).optional(),
            }),
          )
          .max(50)
          .default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const order = await loadRateableOrder(ctx.db, input.orderId, userId);

      // Every product named must actually be in this order — never trust the client.
      if (input.products.length > 0) {
        const variantIds = order.items
          .map((i) => i.variantId)
          .filter((id): id is string => id != null);
        const allowed = variantIds.length
          ? await ctx.db
              .selectDistinct({ productId: schema.productVariants.productId })
              .from(schema.productVariants)
              .where(inArray(schema.productVariants.id, variantIds))
          : [];
        const allowedIds = new Set(allowed.map((a) => a.productId));
        for (const p of input.products) {
          if (!allowedIds.has(p.productId)) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "That product is not part of this order",
            });
          }
        }
      }

      await ctx.db.transaction(async (tx) => {
        await tx
          .insert(schema.orderFeedback)
          .values({
            orderId: input.orderId,
            userId,
            rating: String(input.rating),
            comment: input.comment || null,
            source: "customer",
          })
          .onConflictDoUpdate({
            target: schema.orderFeedback.orderId,
            set: {
              rating: String(input.rating),
              comment: input.comment || null,
              // Re-submitting revives a dismissed prompt and re-opens triage.
              dismissedAt: null,
              status: "new",
              updatedAt: new Date(),
            },
          });

        for (const p of input.products) {
          await tx
            .insert(schema.productRatings)
            .values({
              productId: p.productId,
              userId,
              orderId: input.orderId,
              rating: String(p.rating),
              review: p.review || null,
              source: "customer",
            })
            .onConflictDoUpdate({
              target: [schema.productRatings.productId, schema.productRatings.userId],
              set: {
                rating: String(p.rating),
                review: p.review || null,
                orderId: input.orderId,
                updatedAt: new Date(),
              },
            });
        }
      });

      return { ok: true };
    }),

  // ── User: "not now" ────────────────────────────────────────────────────────
  // Recorded server-side rather than in localStorage so the nudge stays gone on
  // the customer's other devices.

  dismiss: protectedProcedure
    .input(z.object({ orderId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const order = await ctx.db.query.orders.findFirst({
        where: and(eq(schema.orders.id, input.orderId), eq(schema.orders.userId, userId)),
        columns: { id: true },
      });
      if (!order) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.db
        .insert(schema.orderFeedback)
        .values({ orderId: input.orderId, userId, dismissedAt: new Date() })
        .onConflictDoUpdate({
          target: schema.orderFeedback.orderId,
          set: { dismissedAt: new Date(), updatedAt: new Date() },
        });

      return { ok: true };
    }),

  // ── User: everything they have said so far ─────────────────────────────────

  mine: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        id: schema.orderFeedback.id,
        orderId: schema.orderFeedback.orderId,
        orderNumber: schema.orders.orderNumber,
        rating: schema.orderFeedback.rating,
        comment: schema.orderFeedback.comment,
        submittedAt: schema.orderFeedback.updatedAt,
      })
      .from(schema.orderFeedback)
      .innerJoin(schema.orders, eq(schema.orderFeedback.orderId, schema.orders.id))
      .where(
        and(
          eq(schema.orderFeedback.userId, ctx.session.user.id),
          isNotNull(schema.orderFeedback.rating),
        ),
      )
      .orderBy(desc(schema.orderFeedback.updatedAt))
      .limit(50);

    return rows.map((r) => ({ ...r, rating: toRating(r.rating) }));
  }),

  // ── Admin: the feedback inbox ──────────────────────────────────────────────

  adminList: permissionProcedure("feedback", "read")
    .input(
      z.object({
        status: z.enum(["new", "reviewed", "archived"]).optional(),
        source: z.enum(["customer", "staff"]).optional(),
        // "positive" = 4+, "neutral" = 3–3.5, "negative" = 2.5 and below
        sentiment: z.enum(["positive", "neutral", "negative"]).optional(),
        search: z.string().trim().max(120).optional(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const filters = [isNotNull(schema.orderFeedback.rating)];
      if (input.status) filters.push(eq(schema.orderFeedback.status, input.status));
      if (input.source) filters.push(eq(schema.orderFeedback.source, input.source));
      if (input.sentiment === "positive") {
        filters.push(gte(schema.orderFeedback.rating, "4"));
      } else if (input.sentiment === "neutral") {
        filters.push(sql`${schema.orderFeedback.rating} >= 3 AND ${schema.orderFeedback.rating} < 4`);
      } else if (input.sentiment === "negative") {
        filters.push(sql`${schema.orderFeedback.rating} < 3`);
      }
      if (input.search) {
        const term = `%${input.search}%`;
        const match = or(
          ilike(schema.orders.orderNumber, term),
          ilike(schema.user.name, term),
          ilike(schema.user.email, term),
          ilike(schema.orderFeedback.comment, term),
        );
        if (match) filters.push(match);
      }

      const where = and(...filters);

      const rows = await ctx.db
        .select({
          id: schema.orderFeedback.id,
          orderId: schema.orderFeedback.orderId,
          orderNumber: schema.orders.orderNumber,
          customerName: schema.user.name,
          customerEmail: schema.user.email,
          rating: schema.orderFeedback.rating,
          comment: schema.orderFeedback.comment,
          status: schema.orderFeedback.status,
          source: schema.orderFeedback.source,
          createdAt: schema.orderFeedback.createdAt,
          updatedAt: schema.orderFeedback.updatedAt,
        })
        .from(schema.orderFeedback)
        .innerJoin(schema.orders, eq(schema.orderFeedback.orderId, schema.orders.id))
        .innerJoin(schema.user, eq(schema.orderFeedback.userId, schema.user.id))
        .where(where)
        .orderBy(desc(schema.orderFeedback.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const [totals] = await ctx.db
        .select({ total: count() })
        .from(schema.orderFeedback)
        .innerJoin(schema.orders, eq(schema.orderFeedback.orderId, schema.orders.id))
        .innerJoin(schema.user, eq(schema.orderFeedback.userId, schema.user.id))
        .where(where);

      return {
        rows: rows.map((r) => ({ ...r, rating: toRating(r.rating) })),
        total: Number(totals?.total ?? 0),
      };
    }),

  // Headline numbers above the inbox.
  adminStats: permissionProcedure("feedback", "read").query(async ({ ctx }) => {
    const [row] = await ctx.db
      .select({
        total: count(),
        avg: sql<string | null>`avg(${schema.orderFeedback.rating})`,
        unread: sql<number>`count(*) FILTER (WHERE ${schema.orderFeedback.status} = 'new')::int`,
        negative: sql<number>`count(*) FILTER (WHERE ${schema.orderFeedback.rating} < 3)::int`,
      })
      .from(schema.orderFeedback)
      .where(isNotNull(schema.orderFeedback.rating));

    return {
      total: Number(row?.total ?? 0),
      average: row?.avg != null ? Math.round(Number(row.avg) * 10) / 10 : null,
      unread: Number(row?.unread ?? 0),
      negative: Number(row?.negative ?? 0),
    };
  }),

  adminGet: permissionProcedure("feedback", "read")
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select({
          id: schema.orderFeedback.id,
          orderId: schema.orderFeedback.orderId,
          orderNumber: schema.orders.orderNumber,
          userId: schema.orderFeedback.userId,
          customerName: schema.user.name,
          customerEmail: schema.user.email,
          rating: schema.orderFeedback.rating,
          comment: schema.orderFeedback.comment,
          status: schema.orderFeedback.status,
          source: schema.orderFeedback.source,
          recordedByStaffId: schema.orderFeedback.recordedByStaffId,
          internalNote: schema.orderFeedback.internalNote,
          createdAt: schema.orderFeedback.createdAt,
          updatedAt: schema.orderFeedback.updatedAt,
        })
        .from(schema.orderFeedback)
        .innerJoin(schema.orders, eq(schema.orderFeedback.orderId, schema.orders.id))
        .innerJoin(schema.user, eq(schema.orderFeedback.userId, schema.user.id))
        .where(eq(schema.orderFeedback.id, input.id));

      if (!row) throw new TRPCError({ code: "NOT_FOUND" });

      // The fragrance reviews this customer left off the same order.
      const products = await ctx.db
        .select({
          productId: schema.productRatings.productId,
          productName: schema.products.name,
          rating: schema.productRatings.rating,
          review: schema.productRatings.review,
          source: schema.productRatings.source,
        })
        .from(schema.productRatings)
        .innerJoin(schema.products, eq(schema.productRatings.productId, schema.products.id))
        .where(
          and(
            eq(schema.productRatings.orderId, row.orderId),
            eq(schema.productRatings.userId, row.userId),
          ),
        );

      // Who logged it, when a staff member did.
      let recordedBy: string | null = null;
      if (row.recordedByStaffId) {
        const staff = await ctx.db.query.user.findFirst({
          where: eq(schema.user.id, row.recordedByStaffId),
          columns: { name: true, email: true },
        });
        recordedBy = staff?.name ?? staff?.email ?? null;
      }

      return {
        ...row,
        rating: toRating(row.rating),
        recordedBy,
        products: products.map((p) => ({ ...p, rating: toRating(p.rating) })),
      };
    }),

  adminSetStatus: permissionProcedure("feedback", "write")
    .input(z.object({ id: z.string().uuid(), status: z.enum(["new", "reviewed", "archived"]) }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(schema.orderFeedback)
        .set({ status: input.status, updatedAt: new Date() })
        .where(eq(schema.orderFeedback.id, input.id))
        .returning({ id: schema.orderFeedback.id });
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return { ok: true };
    }),

  adminSetNote: permissionProcedure("feedback", "write")
    .input(z.object({ id: z.string().uuid(), internalNote: z.string().trim().max(2000) }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(schema.orderFeedback)
        .set({ internalNote: input.internalNote || null, updatedAt: new Date() })
        .where(eq(schema.orderFeedback.id, input.id))
        .returning({ id: schema.orderFeedback.id });
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return { ok: true };
    }),

  // ── Admin: delivered-order picker for the "log feedback" dialog ────────────

  adminSearchOrders: permissionProcedure("feedback", "write")
    .input(z.object({ search: z.string().trim().max(120).optional() }))
    .query(async ({ ctx, input }) => {
      const filters = [eq(schema.orders.status, "delivered")];
      if (input.search) {
        const term = `%${input.search}%`;
        const match = or(
          ilike(schema.orders.orderNumber, term),
          ilike(schema.user.name, term),
          ilike(schema.user.email, term),
        );
        if (match) filters.push(match);
      }

      const rows = await ctx.db
        .select({
          orderId: schema.orders.id,
          orderNumber: schema.orders.orderNumber,
          customerName: schema.user.name,
          customerEmail: schema.user.email,
          createdAt: schema.orders.createdAt,
          hasFeedback: sql<boolean>`${schema.orderFeedback.rating} IS NOT NULL`,
        })
        .from(schema.orders)
        .innerJoin(schema.user, eq(schema.orders.userId, schema.user.id))
        .leftJoin(schema.orderFeedback, eq(schema.orderFeedback.orderId, schema.orders.id))
        .where(and(...filters))
        .orderBy(desc(schema.orders.createdAt))
        .limit(20);

      return rows;
    }),

  // Products on a delivered order, so staff can log fragrance reviews too.
  adminOrderProducts: permissionProcedure("feedback", "write")
    .input(z.object({ orderId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .selectDistinct({
          productId: schema.productVariants.productId,
          productName: schema.products.name,
        })
        .from(schema.orderItems)
        .innerJoin(schema.productVariants, eq(schema.orderItems.variantId, schema.productVariants.id))
        .innerJoin(schema.products, eq(schema.productVariants.productId, schema.products.id))
        .where(eq(schema.orderItems.orderId, input.orderId));
      return rows;
    }),

  // ── Admin: log feedback a customer gave over phone / WhatsApp ─────────────
  // Attributed to the customer (it is their opinion) but stamped source="staff"
  // with the staff member's id, so the inbox never passes it off as self-served.

  adminLogForCustomer: permissionProcedure("feedback", "write")
    .input(
      z.object({
        orderId: z.string().uuid(),
        rating: halfStar,
        comment: z.string().trim().max(2000).optional(),
        products: z
          .array(
            z.object({
              productId: z.string().uuid(),
              rating: halfStar,
              review: z.string().trim().max(2000).optional(),
            }),
          )
          .max(50)
          .default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const staffId = ctx.session.user.id;

      const order = await ctx.db.query.orders.findFirst({
        where: eq(schema.orders.id, input.orderId),
        columns: { id: true, userId: true, status: true },
      });
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      if (order.status !== "delivered") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Feedback can only be logged against a delivered order",
        });
      }

      await ctx.db.transaction(async (tx) => {
        await tx
          .insert(schema.orderFeedback)
          .values({
            orderId: input.orderId,
            userId: order.userId,
            rating: String(input.rating),
            comment: input.comment || null,
            source: "staff",
            recordedByStaffId: staffId,
          })
          .onConflictDoUpdate({
            target: schema.orderFeedback.orderId,
            set: {
              rating: String(input.rating),
              comment: input.comment || null,
              source: "staff",
              recordedByStaffId: staffId,
              dismissedAt: null,
              updatedAt: new Date(),
            },
          });

        for (const p of input.products) {
          await tx
            .insert(schema.productRatings)
            .values({
              productId: p.productId,
              userId: order.userId,
              orderId: input.orderId,
              rating: String(p.rating),
              review: p.review || null,
              source: "staff",
              recordedByStaffId: staffId,
            })
            .onConflictDoUpdate({
              target: [schema.productRatings.productId, schema.productRatings.userId],
              set: {
                rating: String(p.rating),
                review: p.review || null,
                orderId: input.orderId,
                source: "staff",
                recordedByStaffId: staffId,
                updatedAt: new Date(),
              },
            });
        }
      });

      return { ok: true };
    }),
});
