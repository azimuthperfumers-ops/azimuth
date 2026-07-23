import { z } from "zod";
import { asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import { schema } from "@azimuth/db";
import { adminProcedure } from "../middleware/auth.middleware";
import { createWalletRepository } from "../repositories/wallet.repository";
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
            // short-id lookup: "#AB12CD34" is a prefix of the real user id
            ilike(schema.user.id, `${input.search.replace(/^#/, "")}%`),
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
          // Parcels included so the order rows can show dispatch size — one unit
          // ships per box, so item count alone understates it.
          with: { items: true, shipments: { orderBy: asc(schema.orderShipments.packageNumber) } },
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

  // Customer's wallet as the admin sees it: balance + recent ledger entries.
  wallet: adminProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const wallet = createWalletRepository(ctx.db);
      const [balance, txns] = await Promise.all([
        wallet.getBalance(input.userId),
        wallet.listTransactions(input.userId, { limit: 20 }),
      ]);
      return { balance, transactions: txns.items, total: txns.total };
    }),

  // Manual wallet credit (goodwill, compensation, correction). Money is never
  // "generated" silently — every credit lands as an `adjustment` ledger row with
  // the admin's id and a mandatory reason, visible to the customer.
  // direction "debit" deducts instead (correction, clawback of a mistaken
  // credit). A debit can never push the balance below zero — record() rejects it.
  walletCredit: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        amountInr: z.number().positive().max(100000),
        direction: z.enum(["credit", "debit"]).default("credit"),
        note: z.string().trim().min(3, "A reason is required so the transaction is traceable."),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const target = await ctx.db.query.user.findFirst({
        where: eq(schema.user.id, input.userId),
        columns: { id: true },
      });
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

      const wallet = createWalletRepository(ctx.db);
      await wallet.ensureWallet(input.userId);
      const signed = Math.round(input.amountInr * 100) / 100;
      const { balanceAfter } = await wallet.record({
        userId: input.userId,
        amount: input.direction === "debit" ? -signed : signed,
        type: "adjustment",
        note: input.note,
        actorId: ctx.session.user.id,
      });
      return { balance: balanceAfter };
    }),

  // ── Wallet management page ──────────────────────────────────────────────────

  // Every customer with a wallet: balance + last movement, searchable, paginated.
  // Also returns the store's total outstanding wallet liability.
  walletList: adminProcedure
    .input(
      z.object({
        search: z.string().optional(),
        limit: z.number().int().min(1).max(200).default(50),
        offset: z.number().int().nonnegative().default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      // "#AB12CD34" (the short id shown in the UI) is a prefix of the real user id.
      const idTerm = input.search?.replace(/^#/, "");
      const searchCond = input.search
        ? or(
            ilike(schema.user.name, `%${input.search}%`),
            ilike(schema.user.email, `%${input.search}%`),
            idTerm ? ilike(schema.user.id, `${idTerm}%`) : undefined,
          )
        : undefined;

      const lastTxn = sql<Date | null>`(
        SELECT max(created_at) FROM wallet_transactions wt WHERE wt.user_id = ${schema.wallets.userId}
      )`;

      const [rows, [totals]] = await Promise.all([
        ctx.db
          .select({
            userId: schema.wallets.userId,
            balance: schema.wallets.balance,
            createdAt: schema.wallets.createdAt,
            lastTxnAt: lastTxn,
            userName: schema.user.name,
            userEmail: schema.user.email,
          })
          .from(schema.wallets)
          .innerJoin(schema.user, eq(schema.user.id, schema.wallets.userId))
          .where(searchCond)
          .orderBy(desc(schema.wallets.balance))
          .limit(input.limit)
          .offset(input.offset),
        ctx.db
          .select({
            count: sql<number>`count(*)::int`,
            liability: sql<string>`coalesce(sum(${schema.wallets.balance}), 0)`,
          })
          .from(schema.wallets)
          .innerJoin(schema.user, eq(schema.user.id, schema.wallets.userId))
          .where(searchCond),
      ]);

      return {
        wallets: rows,
        total: Number(totals?.count ?? 0),
        liability: Number(totals?.liability ?? 0),
      };
    }),

  // Full paginated ledger for one customer — the admin-side wallet statement.
  walletTransactions: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().nonnegative().default(0),
      }),
    )
    .query(({ ctx, input }) =>
      createWalletRepository(ctx.db).listTransactions(input.userId, {
        limit: input.limit,
        offset: input.offset,
      }),
    ),

  // Credit several customers at once (campaign goodwill, launch credit, etc).
  // Same rules as single credit: adjustment ledger rows, admin id, mandatory
  // reason. Applied one by one; reports how many succeeded.
  walletBulkCredit: adminProcedure
    .input(
      z.object({
        userIds: z.array(z.string()).min(1).max(200),
        amountInr: z.number().positive().max(100000),
        direction: z.enum(["credit", "debit"]).default("credit"),
        note: z.string().trim().min(3, "A reason is required so the transactions are traceable."),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const wallet = createWalletRepository(ctx.db);
      const signed = Math.round(input.amountInr * 100) / 100;
      const amount = input.direction === "debit" ? -signed : signed;
      let credited = 0;
      const failed: string[] = [];
      for (const userId of input.userIds) {
        try {
          await wallet.ensureWallet(userId);
          await wallet.record({
            userId,
            amount,
            type: "adjustment",
            note: input.note,
            actorId: ctx.session.user.id,
          });
          credited++;
        } catch (err) {
          console.error(`[admin] bulk wallet credit failed for user=${userId}:`, (err as Error).message);
          failed.push(userId);
        }
      }
      return { credited, failed };
    }),
});
