import { relations } from "drizzle-orm";
import { index, pgTable, smallint, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { user } from "./auth";
import { products } from "./catalog";
import { orders } from "./orders";

// One rating per user per product (re-rating updates the row). Rating is allowed
// only after a delivered order containing that product — enforced in the API layer.
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
    rating: smallint("rating").notNull(), // 1–5, validated in API
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
