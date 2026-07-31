ALTER TABLE "orders" ADD COLUMN "refund_waived_at" timestamp;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "refund_waived_by" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "refund_waived_reason" text;