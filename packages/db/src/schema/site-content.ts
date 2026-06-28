import { boolean, index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const siteContent = pgTable("site_content", {
  section: text("section").primaryKey(),
  data: jsonb("data").notNull().default("{}"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const banners = pgTable("banners", {
  id: uuid("id").primaryKey().defaultRandom(),
  page: text("page").notNull(),
  imageUrl: text("image_url").notNull(),
  alt: text("alt").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => [
  index("banners_page_order_idx").on(t.page, t.sortOrder),
]);
