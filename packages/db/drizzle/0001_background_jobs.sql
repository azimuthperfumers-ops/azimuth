CREATE TYPE "public"."job_type" AS ENUM('book_shipment', 'cancel_shipment', 'initiate_refund', 'return_shipment', 'exchange_shipment');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('pending', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "background_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "job_type" NOT NULL,
	"status" "job_status" DEFAULT 'pending' NOT NULL,
	"payload" jsonb NOT NULL,
	"result" jsonb,
	"error_message" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"bullmq_job_id" text,
	"order_id" uuid,
	"ticket_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "background_jobs" ADD CONSTRAINT "background_jobs_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "background_jobs" ADD CONSTRAINT "background_jobs_ticket_id_support_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "background_jobs_type_idx" ON "background_jobs" USING btree ("type");--> statement-breakpoint
CREATE INDEX "background_jobs_status_idx" ON "background_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "background_jobs_order_idx" ON "background_jobs" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "background_jobs_ticket_idx" ON "background_jobs" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "background_jobs_created_at_idx" ON "background_jobs" USING btree ("created_at");
