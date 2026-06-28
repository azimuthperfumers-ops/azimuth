ALTER TYPE "public"."order_status" ADD VALUE IF NOT EXISTS 'return_requested';--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE IF NOT EXISTS 'return_approved';--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE IF NOT EXISTS 'exchange_requested';
