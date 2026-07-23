CREATE TYPE "public"."shipment_status" AS ENUM('pending', 'booked', 'picked_up', 'in_transit', 'out_for_delivery', 'delivery_attempted', 'delivered', 'cancelled', 'rto_initiated', 'rto_delivered', 'failed');--> statement-breakpoint
CREATE TABLE "order_shipments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"package_number" integer NOT NULL,
	"order_item_id" uuid,
	"variant_id" uuid,
	"product_name" text NOT NULL,
	"variant_sku" text NOT NULL,
	"size_ml" integer NOT NULL,
	"weight_grams" integer NOT NULL,
	"length_cm" integer NOT NULL,
	"width_cm" integer NOT NULL,
	"height_cm" integer NOT NULL,
	"status" "shipment_status" DEFAULT 'pending' NOT NULL,
	"waybill" text,
	"courier_name" text,
	"tracking_url" text,
	"estimated_delivery_date" text,
	"pod_image_url" text,
	"shipping_charge_quoted" numeric(10, 2),
	"shipping_cost_actual" numeric(10, 2),
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_shipment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipment_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"from_status" "shipment_status",
	"to_status" "shipment_status" NOT NULL,
	"note" text,
	"actor_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_shipments" ADD CONSTRAINT "order_shipments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_shipments" ADD CONSTRAINT "order_shipments_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_shipments" ADD CONSTRAINT "order_shipments_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_shipment_events" ADD CONSTRAINT "order_shipment_events_shipment_id_order_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."order_shipments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_shipment_events" ADD CONSTRAINT "order_shipment_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_shipments_order_idx" ON "order_shipments" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "order_shipments_order_package_idx" ON "order_shipments" USING btree ("order_id","package_number");--> statement-breakpoint
CREATE UNIQUE INDEX "order_shipments_waybill_idx" ON "order_shipments" USING btree ("waybill");--> statement-breakpoint
CREATE INDEX "order_shipment_events_shipment_idx" ON "order_shipment_events" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "order_shipment_events_order_idx" ON "order_shipment_events" USING btree ("order_id");
