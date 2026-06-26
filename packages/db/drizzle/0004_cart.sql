CREATE TABLE IF NOT EXISTS "cart_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "variant_id" uuid NOT NULL,
  "quantity" integer NOT NULL DEFAULT 1,
  "is_saved" boolean NOT NULL DEFAULT false,
  "added_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "cart_items_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade,
  CONSTRAINT "cart_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS "cart_items_user_idx" ON "cart_items" ("user_id");

DO $$ BEGIN
  CREATE UNIQUE INDEX "cart_items_user_variant_unique" ON "cart_items" ("user_id", "variant_id");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
