import { numeric, pgTable, timestamp } from "drizzle-orm/pg-core";

// Single-row settings table. id is always 1 — enforced by CHECK constraint in migration.
export const siteSettings = pgTable("site_settings", {
  id: numeric("id").primaryKey().default("1"),
  freeShippingAboveInr: numeric("free_shipping_above_inr", { precision: 10, scale: 2 })
    .notNull()
    .default("999"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
