import { relations } from "drizzle-orm";
import { index, numeric, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { user } from "./auth";
import { orders } from "./orders";
import { feedbackSourceEnum } from "./ratings";

// Triage state for the admin feedback inbox.
export const feedbackStatusEnum = pgEnum("feedback_status", ["new", "reviewed", "archived"]);

// How the customer felt about a delivered order overall — delivery, packaging,
// the unboxing. Distinct from product_ratings, which is about the fragrance.
//
// Feedback is PRIVATE: it is never rendered on the storefront to other shoppers.
// Only the author and admin/staff with the `feedback` permission can read it.
//
// One row per order. A row with rating = null and dismissedAt set means the
// customer waved the prompt away — it stops the nudge without faking a score,
// and it survives across devices (localStorage would not).
export const orderFeedback = pgTable(
  "order_feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // 1–5 in 0.5 steps. Null while the row exists only to record a dismissal.
    rating: numeric("rating", { precision: 2, scale: 1 }),
    comment: text("comment"),
    status: feedbackStatusEnum("status").default("new").notNull(),
    source: feedbackSourceEnum("source").default("customer").notNull(),
    // Set only when source = "staff": who logged it on the customer's behalf.
    recordedByStaffId: text("recorded_by_staff_id"),
    // Admin-only working note. Never returned to the customer.
    internalNote: text("internal_note"),
    dismissedAt: timestamp("dismissed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex("order_feedback_order_idx").on(t.orderId),
    index("order_feedback_user_idx").on(t.userId),
    index("order_feedback_status_idx").on(t.status),
    index("order_feedback_created_idx").on(t.createdAt),
  ],
);

export const orderFeedbackRelations = relations(orderFeedback, ({ one }) => ({
  order: one(orders, { fields: [orderFeedback.orderId], references: [orders.id] }),
  user: one(user, { fields: [orderFeedback.userId], references: [user.id] }),
}));
