CREATE TABLE IF NOT EXISTS "site_content" (
  "section" text PRIMARY KEY NOT NULL,
  "data" jsonb NOT NULL DEFAULT '{}',
  "updated_at" timestamp with time zone DEFAULT now()
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "banners" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "page" text NOT NULL,
  "image_url" text NOT NULL,
  "alt" text NOT NULL DEFAULT '',
  "sort_order" integer NOT NULL DEFAULT 0,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now()
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "banners_page_order_idx" ON "banners" USING btree ("page","sort_order");
