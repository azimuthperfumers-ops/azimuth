import type { Database } from "@azimuth/db";
import { schema } from "@azimuth/db";
import { TRPCError } from "@trpc/server";
import { and, count, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";

type WalletTxnType = (typeof schema.walletTxnTypeEnum.enumValues)[number];

export type WalletTxnFilters = {
  limit?: number;
  offset?: number;
  dateFrom?: Date;
  dateTo?: Date;
  direction?: "credit" | "debit";
  types?: WalletTxnType[];
};

export function createWalletRepository(db: Database) {
  return {
    // Ensure a wallet row exists for this user (idempotent) and return it.
    async ensureWallet(userId: string) {
      const existing = await db.query.wallets.findFirst({ where: eq(schema.wallets.userId, userId) });
      if (existing) return existing;
      // ON CONFLICT DO NOTHING guards the race where two requests create it at once.
      await db.insert(schema.wallets).values({ userId }).onConflictDoNothing();
      const [row] = await db.select().from(schema.wallets).where(eq(schema.wallets.userId, userId));
      if (!row) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "wallet init failed" });
      return row;
    },

    async getBalance(userId: string): Promise<number> {
      const w = await db.query.wallets.findFirst({ where: eq(schema.wallets.userId, userId) });
      return Number(w?.balance ?? 0);
    },

    // Single entry point for every balance change. Locks the wallet row, checks
    // funds for debits, writes the immutable ledger entry with the running
    // balance, and updates the cached balance — all in one transaction.
    //   amount > 0 → credit (topup / refund / reversal)
    //   amount < 0 → debit  (order payment)
    // Idempotency: pass idempotencyKey (refType+refId+type) — a matching prior
    // entry short-circuits so webhook/retry re-runs never double-apply.
    async record(params: {
      userId: string;
      amount: number; // signed, rupees
      type: WalletTxnType;
      refType?: string;
      refId?: string;
      note?: string;
      actorId?: string;
      idempotent?: boolean;
    }) {
      const run = () => db.transaction(async (tx) => {
        // Lock the wallet row FIRST (create lazily if missing). Concurrent calls
        // for the same user queue on this lock.
        let [wallet] = await tx
          .select({ balance: schema.wallets.balance })
          .from(schema.wallets)
          .where(eq(schema.wallets.userId, params.userId))
          .for("update");

        if (!wallet) {
          await tx.insert(schema.wallets).values({ userId: params.userId }).onConflictDoNothing();
          [wallet] = await tx
            .select({ balance: schema.wallets.balance })
            .from(schema.wallets)
            .where(eq(schema.wallets.userId, params.userId))
            .for("update");
        }

        // Idempotency guard — one ledger row per (userId, type, refId). Runs
        // AFTER the lock: in READ COMMITTED each statement takes a fresh
        // snapshot, so a caller that waited on the lock sees the winner's
        // committed ledger row and short-circuits instead of double-applying.
        if (params.idempotent && params.refId) {
          const [dupe] = await tx
            .select({ id: schema.walletTransactions.id, balanceAfter: schema.walletTransactions.balanceAfter })
            .from(schema.walletTransactions)
            .where(
              and(
                eq(schema.walletTransactions.userId, params.userId),
                eq(schema.walletTransactions.type, params.type),
                eq(schema.walletTransactions.refId, params.refId),
              ),
            )
            .limit(1);
          if (dupe) return { balanceAfter: Number(dupe.balanceAfter), duplicate: true };
        }

        const current = Number(wallet?.balance ?? 0);
        const balanceAfter = Math.round((current + params.amount) * 100) / 100;

        if (balanceAfter < 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Insufficient wallet balance" });
        }

        await tx.insert(schema.walletTransactions).values({
          userId: params.userId,
          amount: String(params.amount),
          balanceAfter: String(balanceAfter),
          type: params.type,
          refType: params.refType,
          refId: params.refId,
          note: params.note,
          actorId: params.actorId,
        });

        await tx
          .update(schema.wallets)
          .set({ balance: String(balanceAfter) })
          .where(eq(schema.wallets.userId, params.userId));

        return { balanceAfter, duplicate: false };
      });

      try {
        return await run();
      } catch (err) {
        // DB-level backstop: the unique index on (userId, type, refId) turns any
        // race the in-transaction check missed into a 23505 — treat as duplicate.
        const code = (err as { code?: string; cause?: { code?: string } })?.code
          ?? (err as { cause?: { code?: string } })?.cause?.code;
        if (code === "23505" && params.idempotent && params.refId) {
          const dupe = await db.query.walletTransactions.findFirst({
            where: and(
              eq(schema.walletTransactions.userId, params.userId),
              eq(schema.walletTransactions.type, params.type),
              eq(schema.walletTransactions.refId, params.refId),
            ),
          });
          if (dupe) return { balanceAfter: Number(dupe.balanceAfter), duplicate: true };
        }
        throw err;
      }
    },

    // A wallet-paid order that will never be fulfilled (payment window expired,
    // checkout abandoned mid-crash) must give the customer their money back.
    // Finds the order_payment debit for this order and credits an equal
    // `reversal` — idempotent, so sweeps/retries can call it repeatedly.
    async reverseWalletDebitIfAny(orderId: string, note?: string) {
      const debit = await db.query.walletTransactions.findFirst({
        where: and(
          eq(schema.walletTransactions.type, "order_payment"),
          eq(schema.walletTransactions.refId, orderId),
        ),
      });
      if (!debit) return { reversed: false as const };

      const res = await this.record({
        userId: debit.userId,
        amount: Math.abs(Number(debit.amount)),
        type: "reversal",
        refType: "order",
        refId: orderId,
        note: note ?? "Wallet payment reversed — order was not completed",
        idempotent: true,
      });
      return { reversed: !res.duplicate, balanceAfter: res.balanceAfter };
    },

    async listTransactions(userId: string, opts: WalletTxnFilters = {}) {
      const conds = [eq(schema.walletTransactions.userId, userId)];
      if (opts.dateFrom) conds.push(gte(schema.walletTransactions.createdAt, opts.dateFrom));
      if (opts.dateTo) conds.push(lte(schema.walletTransactions.createdAt, opts.dateTo));
      if (opts.direction === "credit") conds.push(sql`${schema.walletTransactions.amount} >= 0`);
      if (opts.direction === "debit") conds.push(sql`${schema.walletTransactions.amount} < 0`);
      if (opts.types && opts.types.length > 0) conds.push(inArray(schema.walletTransactions.type, opts.types));
      const where = and(...conds);

      const limit = opts.limit ?? 20;
      const offset = opts.offset ?? 0;

      const [items, [{ total } = { total: 0 }]] = await Promise.all([
        db.query.walletTransactions.findMany({
          where,
          orderBy: desc(schema.walletTransactions.createdAt),
          limit,
          offset,
        }),
        db.select({ total: count() }).from(schema.walletTransactions).where(where),
      ]);

      return { items, total: Number(total), limit, offset };
    },

    // ── Top-ups ──────────────────────────────────────────────────────────────
    async createTopup(userId: string, amount: number) {
      const [row] = await db
        .insert(schema.walletTopups)
        .values({ userId, amount: String(amount) })
        .returning();
      return row!;
    },

    async setTopupRazorpayOrder(topupId: string, razorpayOrderId: string) {
      await db
        .update(schema.walletTopups)
        .set({ razorpayOrderId })
        .where(eq(schema.walletTopups.id, topupId));
    },

    async findTopupByRazorpayOrder(razorpayOrderId: string) {
      return db.query.walletTopups.findFirst({
        where: eq(schema.walletTopups.razorpayOrderId, razorpayOrderId),
      });
    },

    async markTopupPaid(topupId: string, razorpayPaymentId: string) {
      await db
        .update(schema.walletTopups)
        .set({ status: "paid", razorpayPaymentId })
        .where(eq(schema.walletTopups.id, topupId));
    },

    async markTopupFailed(topupId: string) {
      await db.update(schema.walletTopups).set({ status: "failed" }).where(eq(schema.walletTopups.id, topupId));
    },
  };
}
