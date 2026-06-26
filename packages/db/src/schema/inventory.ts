import { relations } from "drizzle-orm";
import { index, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { user } from "./auth";
import { productVariants } from "./catalog";

export const inventoryReasonEnum = pgEnum("inventory_reason", [
  "restock",
  "sale",
  "return",
  "replacement_out",
  "replacement_in",
  "adjustment",
  "damage",
]);

// Append-only ledger — every stock movement is an immutable row. Current stock
// is product_variants.stock_cached, updated in the same DB transaction as the
// insert here, so the cache can always be rebuilt/verified by replaying this table.
export const inventoryLedger = pgTable(
  "inventory_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "restrict" }),
    delta: integer("delta").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    reason: inventoryReasonEnum("reason").notNull(),
    refType: text("ref_type"),
    refId: uuid("ref_id"),
    actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
    note: text("note"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("inventory_ledger_variant_idx").on(table.variantId, table.createdAt),
  ],
);

export const inventoryLedgerRelations = relations(inventoryLedger, ({ one }) => ({
  variant: one(productVariants, {
    fields: [inventoryLedger.variantId],
    references: [productVariants.id],
  }),
  actor: one(user, { fields: [inventoryLedger.actorId], references: [user.id] }),
}));
