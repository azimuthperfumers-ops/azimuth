CREATE TABLE "site_settings" (
  "id" numeric PRIMARY KEY DEFAULT '1' CHECK (id = 1),
  "free_shipping_above_inr" numeric(10,2) NOT NULL DEFAULT '999',
  "updated_at" timestamptz DEFAULT now()
);

-- Seed the single row so reads never return null
INSERT INTO "site_settings" ("id", "free_shipping_above_inr") VALUES ('1', '999') ON CONFLICT DO NOTHING;
