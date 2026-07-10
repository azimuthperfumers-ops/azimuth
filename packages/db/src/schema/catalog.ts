import { relations, sql } from "drizzle-orm";
import {
  boolean,
  integer,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const productConcentrationEnum = pgEnum("product_concentration", [
  "edp",
  "edt",
  "parfum",
  "cologne",
  "attar",
]);
export const productStatusEnum = pgEnum("product_status", ["draft", "active", "archived"]);
export const notePositionEnum = pgEnum("note_position", ["top", "mid", "base"]);
export const variantStatusEnum = pgEnum("variant_status", ["active", "discontinued"]);

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  parentId: uuid("parent_id").references((): any => categories.id, { onDelete: "set null" }),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const fragranceFamilies = pgTable("fragrance_families", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
});

export const fragranceNotes = pgTable("fragrance_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  familyId: uuid("family_id").references(() => fragranceFamilies.id, { onDelete: "set null" }),
});

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  themeColor: text("theme_color"),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "restrict" }),
  hsnCode: text("hsn_code"),
  longevityRating: smallint("longevity_rating"),
  sillageRating: smallint("sillage_rating"),
  status: productStatusEnum("status").default("draft").notNull(),
  isFeatured: boolean("is_featured").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const productNotes = pgTable(
  "product_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    noteId: uuid("note_id")
      .notNull()
      .references(() => fragranceNotes.id, { onDelete: "restrict" }),
    notePosition: notePositionEnum("note_position").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
  },
  (table) => [
    uniqueIndex("product_notes_unique_idx").on(table.productId, table.noteId, table.notePosition),
  ],
);

export const productVariants = pgTable("product_variants", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  sku: text("sku").notNull().unique(),
  concentration: productConcentrationEnum("concentration").notNull(),
  sizeMl: integer("size_ml").notNull(),
  mrp: numeric("mrp", { precision: 10, scale: 2 }).notNull(),
  weightGrams: integer("weight_grams").notNull(),
  // Packed/shipping box dimensions (outer corrugated box, ready for courier — NOT bottle dimensions)
  boxLengthCm: integer("box_length_cm"),
  boxWidthCm: integer("box_width_cm"),
  boxHeightCm: integer("box_height_cm"),
  barcode: text("barcode").unique(),
  stockCached: integer("stock_cached").default(0).notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
  status: variantStatusEnum("status").default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const productImages = pgTable(
  "product_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "set null" }),
    key: text("key").notNull(),
    altText: text("alt_text"),
    sortOrder: integer("sort_order").default(0).notNull(),
    isPrimary: boolean("is_primary").default(false).notNull(),
    // Secondary = the hover-swap image on web. Optional, at most one per product,
    // mutually exclusive with primary (enforced in the repository).
    isSecondary: boolean("is_secondary").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    // one primary image per product — partial unique index, not a boolean-everywhere check
    uniqueIndex("product_images_primary_idx")
      .on(table.productId)
      .where(sql`${table.isPrimary} = true`),
    // one secondary (hover) image per product
    uniqueIndex("product_images_secondary_idx")
      .on(table.productId)
      .where(sql`${table.isSecondary} = true`),
  ],
);

export const categoryRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, { fields: [categories.parentId], references: [categories.id] }),
  children: many(categories),
  products: many(products),
}));

export const fragranceFamilyRelations = relations(fragranceFamilies, ({ many }) => ({
  notes: many(fragranceNotes),
}));

export const fragranceNoteRelations = relations(fragranceNotes, ({ one, many }) => ({
  family: one(fragranceFamilies, {
    fields: [fragranceNotes.familyId],
    references: [fragranceFamilies.id],
  }),
  productNotes: many(productNotes),
}));

export const productRelations = relations(products, ({ one, many }) => ({
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  variants: many(productVariants),
  images: many(productImages),
  notes: many(productNotes),
}));

export const productNoteRelations = relations(productNotes, ({ one }) => ({
  product: one(products, { fields: [productNotes.productId], references: [products.id] }),
  note: one(fragranceNotes, { fields: [productNotes.noteId], references: [fragranceNotes.id] }),
}));

export const productVariantRelations = relations(productVariants, ({ one, many }) => ({
  product: one(products, { fields: [productVariants.productId], references: [products.id] }),
  images: many(productImages),
}));

export const productImageRelations = relations(productImages, ({ one }) => ({
  product: one(products, { fields: [productImages.productId], references: [products.id] }),
  variant: one(productVariants, {
    fields: [productImages.variantId],
    references: [productVariants.id],
  }),
}));
