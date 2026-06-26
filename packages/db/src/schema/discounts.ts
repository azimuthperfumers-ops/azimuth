import { relations } from "drizzle-orm";
import {
  boolean,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { products, productVariants } from "./catalog";

export const discountTypeEnum = pgEnum("discount_type", ["percentage", "flat"]);

export const discounts = pgTable("discounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  type: discountTypeEnum("type").notNull(),
  value: numeric("value", { precision: 10, scale: 2 }).notNull(),
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const discountProducts = pgTable(
  "discount_products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    discountId: uuid("discount_id")
      .notNull()
      .references(() => discounts.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("discount_products_unique_idx").on(table.productId, table.variantId),
  ],
);

export const discountRelations = relations(discounts, ({ many }) => ({
  products: many(discountProducts),
}));

export const discountProductRelations = relations(discountProducts, ({ one }) => ({
  discount: one(discounts, { fields: [discountProducts.discountId], references: [discounts.id] }),
  product: one(products, { fields: [discountProducts.productId], references: [products.id] }),
  variant: one(productVariants, {
    fields: [discountProducts.variantId],
    references: [productVariants.id],
  }),
}));
