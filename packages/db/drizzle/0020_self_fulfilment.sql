CREATE TYPE "public"."courier_cancel_state" AS ENUM('not_requested', 'pending', 'cancelled', 'failed');--> statement-breakpoint
CREATE TYPE "public"."fulfillment_channel" AS ENUM('shiprocket', 'manual');--> statement-breakpoint
ALTER TYPE "public"."job_type" ADD VALUE 'cancel_parcel' BEFORE 'initiate_refund';--> statement-breakpoint
ALTER TABLE "order_shipments" ADD COLUMN "fulfillment_channel" "fulfillment_channel" DEFAULT 'shiprocket' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_shipments" ADD COLUMN "manual_courier_name" text;--> statement-breakpoint
ALTER TABLE "order_shipments" ADD COLUMN "manual_tracking_number" text;--> statement-breakpoint
ALTER TABLE "order_shipments" ADD COLUMN "manual_tracking_url" text;--> statement-breakpoint
ALTER TABLE "order_shipments" ADD COLUMN "manual_shipped_at" timestamp;--> statement-breakpoint
ALTER TABLE "order_shipments" ADD COLUMN "detached_waybill" text;--> statement-breakpoint
ALTER TABLE "order_shipments" ADD COLUMN "detached_at" timestamp;--> statement-breakpoint
ALTER TABLE "order_shipments" ADD COLUMN "detached_by" text;--> statement-breakpoint
ALTER TABLE "order_shipments" ADD COLUMN "detach_reason" text;--> statement-breakpoint
ALTER TABLE "order_shipments" ADD COLUMN "courier_cancel_state" "courier_cancel_state" DEFAULT 'not_requested' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_shipments" ADD COLUMN "courier_cancel_note" text;--> statement-breakpoint
CREATE INDEX "order_shipments_detached_waybill_idx" ON "order_shipments" USING btree ("detached_waybill");