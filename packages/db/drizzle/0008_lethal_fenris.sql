CREATE TYPE "public"."rating_display_mode" AS ENUM('real', 'mock');--> statement-breakpoint
CREATE TABLE "product_ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"order_id" uuid NOT NULL,
	"rating" smallint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "rating_display_mode" "rating_display_mode" DEFAULT 'mock' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "mock_rating" numeric(2, 1) DEFAULT '4.8' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "mock_rating_count" integer DEFAULT 24 NOT NULL;--> statement-breakpoint
ALTER TABLE "product_ratings" ADD CONSTRAINT "product_ratings_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_ratings" ADD CONSTRAINT "product_ratings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_ratings" ADD CONSTRAINT "product_ratings_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "product_ratings_product_user_idx" ON "product_ratings" USING btree ("product_id","user_id");--> statement-breakpoint
CREATE INDEX "product_ratings_product_idx" ON "product_ratings" USING btree ("product_id");