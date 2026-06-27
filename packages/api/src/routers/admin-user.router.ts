import { z } from "zod";
import { desc, eq, ilike, or, sql } from "drizzle-orm";

import { schema } from "@azimuth/db";
import { adminProcedure } from "../middleware/auth.middleware";
import { router } from "../trpc";

export const adminUserRouter = router({
  list: adminProcedure
    .input(
      z.object({
        search: z.string().optional(),
        limit: z.number().int().min(1).max(200).default(50),
        offset: z.number().int().nonnegative().default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limit, offset } = input;

      const where = input.search
        ? or(
            ilike(schema.user.name, `%${input.search}%`),
            ilike(schema.user.email, `%${input.search}%`),
            ilike(schema.user.phone, `%${input.search}%`),
            ilike(schema.user.phoneNumber, `%${input.search}%`),
          )
        : undefined;

      const [users, countResult] = await Promise.all([
        ctx.db.query.user.findMany({
          where,
          columns: {
            id: true,
            name: true,
            email: true,
            phone: true,
            phoneNumber: true,
            role: true,
            createdAt: true,
            emailVerified: true,
          },
          orderBy: desc(schema.user.createdAt),
          limit,
          offset,
        }),
        ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(schema.user)
          .where(where),
      ]);

      // attach order count per user
      const userIds = users.map((u) => u.id);
      let orderCounts: Record<string, number> = {};
      if (userIds.length > 0) {
        const rows = await ctx.db
          .select({
            userId: schema.orders.userId,
            count: sql<number>`count(*)::int`,
          })
          .from(schema.orders)
          .where(
            sql`${schema.orders.userId} = ANY(ARRAY[${sql.join(userIds.map((id) => sql`${id}`), sql`, `)}]::text[])`,
          )
          .groupBy(schema.orders.userId);
        orderCounts = Object.fromEntries(rows.map((r) => [r.userId, r.count]));
      }

      return {
        users: users.map((u) => ({
          ...u,
          orderCount: orderCounts[u.id] ?? 0,
          phone: u.phone ?? u.phoneNumber ?? null,
        })),
        total: countResult[0]?.count ?? 0,
      };
    }),

  get: adminProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.query.user.findFirst({
        where: eq(schema.user.id, input.userId),
      });
      if (!user) throw new Error("User not found");

      const [orders, tickets] = await Promise.all([
        ctx.db.query.orders.findMany({
          where: eq(schema.orders.userId, input.userId),
          with: { items: true },
          orderBy: desc(schema.orders.createdAt),
        }),
        ctx.db.query.tickets.findMany({
          where: eq(schema.tickets.userId, input.userId),
          orderBy: desc(schema.tickets.createdAt),
          columns: {
            id: true,
            subject: true,
            type: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
      ]);

      return { user, orders, tickets };
    }),
});
