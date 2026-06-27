import { z } from "zod";
import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";

import { schema } from "@azimuth/db";
import { adminProcedure } from "../middleware/auth.middleware";
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
});
