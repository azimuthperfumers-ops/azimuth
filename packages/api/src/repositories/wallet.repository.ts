import type { Database } from "@azimuth/db";
import { schema } from "@azimuth/db";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";

type WalletTxnType = (typeof schema.walletTxnTypeEnum.enumValues)[number];

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
      return db.transaction(async (tx) => {
        // Idempotency guard — one ledger row per (type, refType, refId).
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

        // Lock the wallet row (create lazily if missing).
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
    },

    async listTransactions(userId: string, opts: { limit?: number; offset?: number } = {}) {
      return db.query.walletTransactions.findMany({
        where: eq(schema.walletTransactions.userId, userId),
        orderBy: desc(schema.walletTransactions.createdAt),
        limit: opts.limit ?? 50,
        offset: opts.offset ?? 0,
      });
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
