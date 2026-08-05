CREATE TYPE "public"."feedback_source" AS ENUM('customer', 'staff');--> statement-breakpoint
CREATE TYPE "public"."feedback_status" AS ENUM('new', 'reviewed', 'archived');--> statement-breakpoint
CREATE TABLE "order_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"rating" numeric(2, 1),
	"comment" text,
	"status" "feedback_status" DEFAULT 'new' NOT NULL,
	"source" "feedback_source" DEFAULT 'customer' NOT NULL,
	"recorded_by_staff_id" text,
	"internal_note" text,
	"dismissed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_ratings" ALTER COLUMN "rating" SET DATA TYPE numeric(2, 1);--> statement-breakpoint
ALTER TABLE "product_ratings" ADD COLUMN "review" text;--> statement-breakpoint
ALTER TABLE "product_ratings" ADD COLUMN "source" "feedback_source" DEFAULT 'customer' NOT NULL;--> statement-breakpoint
ALTER TABLE "product_ratings" ADD COLUMN "recorded_by_staff_id" text;--> statement-breakpoint
ALTER TABLE "order_feedback" ADD CONSTRAINT "order_feedback_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_feedback" ADD CONSTRAINT "order_feedback_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "order_feedback_order_idx" ON "order_feedback" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_feedback_user_idx" ON "order_feedback" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "order_feedback_status_idx" ON "order_feedback" USING btree ("status");--> statement-breakpoint
CREATE INDEX "order_feedback_created_idx" ON "order_feedback" USING btree ("created_at");