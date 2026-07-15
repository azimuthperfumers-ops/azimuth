import { relations } from "drizzle-orm";
import { index, numeric, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { user } from "./auth";

// In-app store credit. One-way: money flows INTO the wallet (top-up, refund
// credit) and is spent on orders — it can never be withdrawn back to cash.
// There is deliberately no "cash out" transaction type or endpoint.

export const walletTxnTypeEnum = pgEnum("wallet_txn_type", [
  "topup",          // + customer added money via Razorpay
  "order_payment",  // − spent paying for an order
  "refund_credit",  // + admin refunded an order to the wallet
  "reversal",       // + a wallet-paid order failed; balance returned
  "adjustment",     // ± manual admin correction
]);

export const walletTopupStatusEnum = pgEnum("wallet_topup_status", [
  "pending",
  "paid",
  "failed",
]);

// Cached balance. Authoritative history lives in wallet_transactions; this is
// updated in the SAME db transaction as each ledger insert so it can always be
// rebuilt by replaying the ledger.
export const wallets = pgTable("wallets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  balance: numeric("balance", { precision: 10, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// Append-only ledger — every wallet movement is an immutable row. `amount` is
// signed: positive = credit, negative = debit. `balanceAfter` is the running
// balance so the customer's statement reads correctly without recomputation.
export const walletTransactions = pgTable(
  "wallet_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
    balanceAfter: numeric("balance_after", { precision: 10, scale: 2 }).notNull(),
    type: walletTxnTypeEnum("type").notNull(),
    refType: text("ref_type"), // "order" | "topup" | "refund"
    refId: uuid("ref_id"),
    note: text("note"),
    actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("wallet_transactions_user_idx").on(t.userId, t.createdAt)],
);

// Pending Razorpay top-up orders. On payment.captured the wallet is credited and
// this row flips to "paid".
export const walletTopups = pgTable("wallet_topups", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  razorpayOrderId: text("razorpay_order_id"),
  razorpayPaymentId: text("razorpay_payment_id"),
  status: walletTopupStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const walletRelations = relations(wallets, ({ one }) => ({
  user: one(user, { fields: [wallets.userId], references: [user.id] }),
}));

export const walletTransactionRelations = relations(walletTransactions, ({ one }) => ({
  user: one(user, { fields: [walletTransactions.userId], references: [user.id] }),
}));
