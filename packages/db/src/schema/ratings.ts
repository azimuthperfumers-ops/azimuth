import { relations } from "drizzle-orm";
import { index, numeric, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { user } from "./auth";
import { products } from "./catalog";
import { orders } from "./orders";

// Who put the rating in: the customer themselves, or a staff member recording
// what a customer said over phone/WhatsApp. Shared with order feedback.
export const feedbackSourceEnum = pgEnum("feedback_source", ["customer", "staff"]);

// One rating per user per product (re-rating updates the row). Rating is allowed
// only after a delivered order containing that product — enforced in the API layer.
// Ratings are half-star: 1, 1.5, 2 … 5. Stored numeric(2,1); drizzle hands these
// back as strings, so the API layer converts with Number() (same as mock_rating).
export const productRatings = pgTable(
  "product_ratings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Which delivered order unlocked this rating — audit trail, not a uniqueness key
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    rating: numeric("rating", { precision: 2, scale: 1 }).notNull(), // 1–5 in 0.5 steps, validated in API
    // Optional written note about the fragrance. Never shown to other shoppers —
    // admin-only, same as order feedback.
    review: text("review"),
    source: feedbackSourceEnum("source").default("customer").notNull(),
    // Set only when source = "staff": the admin/staff user who logged it.
    recordedByStaffId: text("recorded_by_staff_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex("product_ratings_product_user_idx").on(t.productId, t.userId),
    index("product_ratings_product_idx").on(t.productId),
  ],
);

export const productRatingRelations = relations(productRatings, ({ one }) => ({
  product: one(products, { fields: [productRatings.productId], references: [products.id] }),
  user: one(user, { fields: [productRatings.userId], references: [user.id] }),
  order: one(orders, { fields: [productRatings.orderId], references: [orders.id] }),
}));
