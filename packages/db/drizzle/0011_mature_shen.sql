ALTER TABLE "orders" ADD COLUMN "gst_invoice_date" timestamp;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "invoice_url" text;--> statement-breakpoint
CREATE UNIQUE INDEX "orders_gst_invoice_number_idx" ON "orders" USING btree ("gst_invoice_number");