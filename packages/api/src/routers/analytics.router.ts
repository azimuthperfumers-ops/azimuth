import { z } from "zod";
import { and, avg, count, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";

import { schema } from "@azimuth/db";
import { adminProcedure } from "../middleware/auth.middleware";
import { cacheGetOrSet } from "../lib/redis";
import { router } from "../trpc";

const CONFIRMED_STATUSES = [
  "paid", "processing", "picked_up", "shipped",
  "out_for_delivery", "delivery_attempted", "delivered",
  "rto_initiated", "rto_delivered",
] as const;

const RETURN_STATUSES = ["rto_initiated", "rto_delivered"] as const;

export const analyticsRouter = router({
  orders: adminProcedure
    .input(z.object({
      zoom: z.enum(["week", "month", "year"]),
      periodStart: z.string().optional(), // ISO date string — e.g. "2026-06-01"
    }))
    .query(async ({ ctx, input }) => {
      const db = ctx.db;
      const now = new Date();

      let startDate: Date;
      let endDate: Date;
      let trunc: "day" | "month";

      if (input.periodStart) {
        const anchor = new Date(input.periodStart);
        if (input.zoom === "week") {
          startDate = new Date(anchor);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + 7);
          trunc = "day";
        } else if (input.zoom === "month") {
          startDate = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
          endDate = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1);
          trunc = "day";
        } else {
          startDate = new Date(anchor.getFullYear(), 0, 1);
          endDate = new Date(anchor.getFullYear() + 1, 0, 1);
          trunc = "month";
        }
      } else {
        // Default: current period
        if (input.zoom === "week") {
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 6);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(now);
          endDate.setDate(endDate.getDate() + 1);
          trunc = "day";
        } else if (input.zoom === "month") {
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
          trunc = "day";
        } else {
          startDate = new Date(now.getFullYear(), 0, 1);
          endDate = new Date(now.getFullYear() + 1, 0, 1);
          trunc = "month";
        }
      }

      // ── Time-series via db.select() ───────────────────────────────────────────
      const confirmedList = CONFIRMED_STATUSES.map((s) => `'${s}'`).join(",");
      const bucketExpr = sql<string>`date_trunc(${sql.raw(`'${trunc}'`)}, ${schema.orders.createdAt} AT TIME ZONE 'Asia/Kolkata')`;

      const rows = await db
        .select({
          bucket: bucketExpr,
          orderCount: sql<number>`COUNT(*)::int`,
          revenue: sql<number>`COALESCE(SUM(${schema.orders.total}::numeric) FILTER (WHERE ${schema.orders.status} IN (${sql.raw(confirmedList)})), 0)`,
          shippingCustomer: sql<number>`COALESCE(SUM(${schema.orders.shippingCharge}::numeric), 0)`,
          shippingActual: sql<number>`COALESCE(SUM(${schema.orders.shippingCostActual}::numeric), 0)`,
        })
        .from(schema.orders)
        .where(and(gte(schema.orders.createdAt, startDate), lt(schema.orders.createdAt, endDate)))
        .groupBy(bucketExpr)
        .orderBy(bucketExpr);

      // ── Returns (RTO) ─────────────────────────────────────────────────────────
      const returns = await db.query.orders.findMany({
        where: and(
          gte(schema.orders.createdAt, startDate),
          lt(schema.orders.createdAt, endDate),
          inArray(schema.orders.status, [...RETURN_STATUSES]),
        ),
        columns: {
          id: true,
          orderNumber: true,
          status: true,
          total: true,
          shippingAddress: true,
          createdAt: true,
        },
        orderBy: desc(schema.orders.createdAt),
      });

      // ── Exchanges (support tickets type=exchange) ──────────────────────────────
      const exchanges = await db.query.tickets.findMany({
        where: and(
          gte(schema.tickets.createdAt, startDate),
          lt(schema.tickets.createdAt, endDate),
          eq(schema.tickets.type, "exchange"),
        ),
        columns: {
          id: true,
          subject: true,
          status: true,
          createdAt: true,
        },
        with: {
          user: { columns: { name: true, email: true } },
          order: { columns: { id: true, orderNumber: true, total: true } },
        },
        orderBy: desc(schema.tickets.createdAt),
      });

      // ── Refunds ───────────────────────────────────────────────────────────────
      const refunds = await db.query.orders.findMany({
        where: and(
          gte(schema.orders.createdAt, startDate),
          lt(schema.orders.createdAt, endDate),
          eq(schema.orders.status, "refunded"),
        ),
        columns: {
          id: true,
          orderNumber: true,
          total: true,
          shippingAddress: true,
          createdAt: true,
        },
        orderBy: desc(schema.orders.createdAt),
      });

      // ── Totals ────────────────────────────────────────────────────────────────
      const timeSeries = rows.map((r) => ({
        bucket: String(r.bucket),
        orderCount: Number(r.orderCount),
        revenue: Number(r.revenue),
        shippingCustomer: Number(r.shippingCustomer),
        shippingActual: Number(r.shippingActual),
        shippingAbsorbed: Math.max(0, Number(r.shippingActual) - Number(r.shippingCustomer)),
      }));

      const totalOrders = timeSeries.reduce((s, r) => s + r.orderCount, 0);
      const totalRevenue = timeSeries.reduce((s, r) => s + r.revenue, 0);
      const totalShippingCustomer = timeSeries.reduce((s, r) => s + r.shippingCustomer, 0);
      const totalShippingActual = timeSeries.reduce((s, r) => s + r.shippingActual, 0);
      const totalShippingAbsorbed = Math.max(0, totalShippingActual - totalShippingCustomer);

      return {
        timeSeries,
        returns,
        exchanges,
        refunds,
        periodDateFrom: startDate.toISOString().split("T")[0],
        periodDateTo: new Date(endDate.getTime() - 1).toISOString().split("T")[0],
        summary: {
          totalOrders,
          totalRevenue,
          totalShippingCustomer,
          totalShippingActual,
          totalShippingAbsorbed,
          returnCount: returns.length,
          exchangeCount: exchanges.length,
          refundCount: refunds.length,
          returnRate: totalOrders > 0 ? returns.length / totalOrders : 0,
          exchangeRate: totalOrders > 0 ? exchanges.length / totalOrders : 0,
          refundRate: totalOrders > 0 ? refunds.length / totalOrders : 0,
        },
      };
    }),

  // ── Per-product deep-dive (heavy aggregates — Redis-cached 10 min) ──────────

  productDetail: adminProcedure
    .input(z.object({ productId: z.string().uuid() }))
    .query(({ ctx, input }) =>
      cacheGetOrSet(`analytics:product:${input.productId}`, 600, async () => {
        const db = ctx.db;

        const product = await db.query.products.findFirst({
          where: eq(schema.products.id, input.productId),
          columns: { id: true, name: true, ratingDisplayMode: true, mockRating: true, mockRatingCount: true },
          with: { variants: { columns: { id: true, sku: true, sizeMl: true, mrp: true, stockCached: true } } },
        });
        if (!product) return null;

        const variantIds = product.variants.map((v) => v.id);
        if (variantIds.length === 0) return null;

        const confirmedList = sql.raw(CONFIRMED_STATUSES.map((s) => `'${s}'`).join(","));

        // ── Lifetime + windowed revenue/units from order lines ──────────────────
        const now = new Date();
        const d30 = new Date(now.getTime() - 30 * 86400000);
        const d90 = new Date(now.getTime() - 90 * 86400000);
        // Raw sql`` templates can't take Date params (postgres.js serialization) — use ISO strings
        const d30Iso = d30.toISOString();

        const [lifetime] = await db
          .select({
            revenue: sql<number>`COALESCE(SUM(${schema.orderItems.lineTotal}::numeric) FILTER (WHERE ${schema.orders.status} IN (${confirmedList})), 0)`,
            units: sql<number>`COALESCE(SUM(${schema.orderItems.quantity}) FILTER (WHERE ${schema.orders.status} IN (${confirmedList})), 0)::int`,
            orders: sql<number>`COUNT(DISTINCT ${schema.orders.id}) FILTER (WHERE ${schema.orders.status} IN (${confirmedList}))::int`,
            buyers: sql<number>`COUNT(DISTINCT ${schema.orders.userId}) FILTER (WHERE ${schema.orders.status} IN (${confirmedList}))::int`,
            revenue30: sql<number>`COALESCE(SUM(${schema.orderItems.lineTotal}::numeric) FILTER (WHERE ${schema.orders.status} IN (${confirmedList}) AND ${schema.orders.createdAt} >= ${d30Iso}), 0)`,
            units30: sql<number>`COALESCE(SUM(${schema.orderItems.quantity}) FILTER (WHERE ${schema.orders.status} IN (${confirmedList}) AND ${schema.orders.createdAt} >= ${d30Iso}), 0)::int`,
            deliveredOrders: sql<number>`COUNT(DISTINCT ${schema.orders.id}) FILTER (WHERE ${schema.orders.status} = 'delivered')::int`,
            returnedOrders: sql<number>`COUNT(DISTINCT ${schema.orders.id}) FILTER (WHERE ${schema.orders.status} IN ('rto_initiated','rto_delivered','refund_processing','refunded'))::int`,
            cancelledOrders: sql<number>`COUNT(DISTINCT ${schema.orders.id}) FILTER (WHERE ${schema.orders.status} = 'cancelled')::int`,
            allOrders: sql<number>`COUNT(DISTINCT ${schema.orders.id})::int`,
            avgSellingPrice: sql<number>`COALESCE(AVG(${schema.orderItems.unitPrice}::numeric) FILTER (WHERE ${schema.orders.status} IN (${confirmedList})), 0)`,
            avgMrp: sql<number>`COALESCE(AVG(${schema.orderItems.mrp}::numeric) FILTER (WHERE ${schema.orders.status} IN (${confirmedList})), 0)`,
          })
          .from(schema.orderItems)
          .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
          .where(inArray(schema.orderItems.variantId, variantIds));

        // ── Monthly trend, last 12 months ────────────────────────────────────────
        const d365 = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        const monthExpr = sql<string>`date_trunc('month', ${schema.orders.createdAt} AT TIME ZONE 'Asia/Kolkata')`;
        const trend = await db
          .select({
            month: monthExpr,
            revenue: sql<number>`COALESCE(SUM(${schema.orderItems.lineTotal}::numeric), 0)`,
            units: sql<number>`COALESCE(SUM(${schema.orderItems.quantity}), 0)::int`,
          })
          .from(schema.orderItems)
          .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
          .where(
            and(
              inArray(schema.orderItems.variantId, variantIds),
              gte(schema.orders.createdAt, d365),
              sql`${schema.orders.status} IN (${confirmedList})`,
            ),
          )
          .groupBy(monthExpr)
          .orderBy(monthExpr);

        // ── Per-variant split ────────────────────────────────────────────────────
        const variantSplit = await db
          .select({
            variantId: schema.orderItems.variantId,
            revenue: sql<number>`COALESCE(SUM(${schema.orderItems.lineTotal}::numeric), 0)`,
            units: sql<number>`COALESCE(SUM(${schema.orderItems.quantity}), 0)::int`,
          })
          .from(schema.orderItems)
          .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
          .where(
            and(
              inArray(schema.orderItems.variantId, variantIds),
              sql`${schema.orders.status} IN (${confirmedList})`,
            ),
          )
          .groupBy(schema.orderItems.variantId);
        const splitMap = new Map(variantSplit.map((v) => [v.variantId, v]));

        // ── Repeat buyers ────────────────────────────────────────────────────────
        const repeat = await db
          .select({
            userId: schema.orders.userId,
            orderCount: sql<number>`COUNT(DISTINCT ${schema.orders.id})::int`,
          })
          .from(schema.orderItems)
          .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
          .where(
            and(
              inArray(schema.orderItems.variantId, variantIds),
              sql`${schema.orders.status} IN (${confirmedList})`,
            ),
          )
          .groupBy(schema.orders.userId);
        const repeatBuyers = repeat.filter((r) => Number(r.orderCount) >= 2).length;

        // ── Ratings: real aggregate + 1–5 distribution ───────────────────────────
        const [ratingAgg] = await db
          .select({ avg: avg(schema.productRatings.rating), count: count() })
          .from(schema.productRatings)
          .where(eq(schema.productRatings.productId, input.productId));
        const distribution = await db
          .select({ rating: schema.productRatings.rating, count: count() })
          .from(schema.productRatings)
          .where(eq(schema.productRatings.productId, input.productId))
          .groupBy(schema.productRatings.rating);

        // ── Demand signals + share of store revenue ──────────────────────────────
        const [wishlisted] = await db
          .select({ count: count() })
          .from(schema.wishlistItems)
          .where(eq(schema.wishlistItems.productId, input.productId));
        const [inCarts] = await db
          .select({ count: count() })
          .from(schema.cartItems)
          .where(and(inArray(schema.cartItems.variantId, variantIds), eq(schema.cartItems.isSaved, false)));
        const [store] = await db
          .select({
            revenue: sql<number>`COALESCE(SUM(${schema.orders.total}::numeric) FILTER (WHERE ${schema.orders.status} IN (${confirmedList})), 0)`,
          })
          .from(schema.orders);

        // Windowed revenue 31–90 days back, for a momentum comparison vs last 30
        const [prevWindow] = await db
          .select({
            revenue: sql<number>`COALESCE(SUM(${schema.orderItems.lineTotal}::numeric), 0)`,
          })
          .from(schema.orderItems)
          .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
          .where(
            and(
              inArray(schema.orderItems.variantId, variantIds),
              gte(schema.orders.createdAt, d90),
              lt(schema.orders.createdAt, d30),
              sql`${schema.orders.status} IN (${confirmedList})`,
            ),
          );

        const totalStock = product.variants.reduce((s, v) => s + v.stockCached, 0);
        const l = lifetime!;
        const delivered = Number(l.deliveredOrders);
        const returned = Number(l.returnedOrders);
        const completedOrReturned = delivered + returned;

        return {
          product: { id: product.id, name: product.name },
          revenue: {
            lifetime: Number(l.revenue),
            last30Days: Number(l.revenue30),
            prev30To90Days: Number(prevWindow?.revenue ?? 0) / 2, // 60-day window halved → per-30d comparable
            storeShare: Number(store?.revenue) > 0 ? Number(l.revenue) / Number(store!.revenue) : 0,
          },
          units: {
            lifetime: Number(l.units),
            last30Days: Number(l.units30),
            currentStock: totalStock,
            // Months of stock left at the last-30-days run rate
            stockCoverMonths: Number(l.units30) > 0 ? totalStock / Number(l.units30) : null,
          },
          orders: {
            confirmed: Number(l.orders),
            buyers: Number(l.buyers),
            repeatBuyers,
            repeatRate: Number(l.buyers) > 0 ? repeatBuyers / Number(l.buyers) : 0,
            avgRevenuePerOrder: Number(l.orders) > 0 ? Number(l.revenue) / Number(l.orders) : 0,
          },
          ratios: {
            returnRate: completedOrReturned > 0 ? returned / completedOrReturned : 0,
            cancellationRate: Number(l.allOrders) > 0 ? Number(l.cancelledOrders) / Number(l.allOrders) : 0,
            realizedDiscount: Number(l.avgMrp) > 0 ? 1 - Number(l.avgSellingPrice) / Number(l.avgMrp) : 0,
            avgSellingPrice: Number(l.avgSellingPrice),
          },
          rating: {
            displayMode: product.ratingDisplayMode,
            real: ratingAgg?.avg != null ? Math.round(Number(ratingAgg.avg) * 10) / 10 : null,
            realCount: Number(ratingAgg?.count ?? 0),
            mock: Number(product.mockRating),
            mockCount: product.mockRatingCount,
            distribution: [1, 2, 3, 4, 5].map((r) => ({
              rating: r,
              count: Number(distribution.find((d) => d.rating === r)?.count ?? 0),
            })),
          },
          demand: {
            wishlisted: Number(wishlisted?.count ?? 0),
            inCarts: Number(inCarts?.count ?? 0),
          },
          monthlyTrend: trend.map((t) => ({
            month: String(t.month),
            revenue: Number(t.revenue),
            units: Number(t.units),
          })),
          variantSplit: product.variants.map((v) => ({
            variantId: v.id,
            sku: v.sku,
            sizeMl: v.sizeMl,
            stock: v.stockCached,
            revenue: Number(splitMap.get(v.id)?.revenue ?? 0),
            units: Number(splitMap.get(v.id)?.units ?? 0),
          })),
          cachedAt: new Date().toISOString(),
        };
      }),
    ),
});
