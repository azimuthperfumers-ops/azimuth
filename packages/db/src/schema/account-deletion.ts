import { relations } from "drizzle-orm";
import { index, integer, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { user } from "./auth";

// Append-only record of self-service account deletions (the /delete-account
// flow on the storefront). The `user` row itself is anonymised in place rather
// than removed — orders reference it with onDelete:'restrict' and their GST
// invoices must be retained — so this table is the only place the original
// identity survives, and the only way an admin can answer "who was #AB12CD34,
// and did they walk away from wallet credit?".
//
// Never updated or deleted. One row per deletion; a customer who signs up again
// with the same email and deletes again produces a second row.
export const accountDeletions = pgTable(
  "account_deletions",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // The anonymised user row this deletion produced. set null (not cascade) so
    // the audit trail outlives even a manual DB-level purge of the user.
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),

    // Identity as it stood at deletion time. The live `user` row no longer has it.
    originalEmail: text("original_email").notNull(),
    originalName: text("original_name"),
    originalPhone: text("original_phone"),

    // Store credit left behind. It is deliberately NOT zeroed out — the wallet
    // row and its ledger stay intact so the balance still counts towards the
    // store's outstanding liability and can be honoured if the person writes in.
    walletBalance: numeric("wallet_balance", { precision: 10, scale: 2 }).notNull().default("0"),

    // How many orders the (now ghosted) account leaves behind in the books.
    orderCount: integer("order_count").notNull().default(0),

    // Optional free-text the customer typed on the way out.
    reason: text("reason"),

    // Who/where the request came from. Deletion is irreversible, so keep enough
    // to investigate a disputed one.
    ipAddress: text("ip_address"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("account_deletions_user_idx").on(t.userId),
    index("account_deletions_created_idx").on(t.createdAt),
    index("account_deletions_email_idx").on(t.originalEmail),
  ],
);

export const accountDeletionRelations = relations(accountDeletions, ({ one }) => ({
  user: one(user, { fields: [accountDeletions.userId], references: [user.id] }),
}));
