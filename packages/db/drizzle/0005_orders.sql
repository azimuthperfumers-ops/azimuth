-- Enums
DO $$ BEGIN
  CREATE TYPE "order_status" AS ENUM (
    'pending_payment', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "payment_gateway" AS ENUM ('razorpay', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "payment_attempt_status" AS ENUM ('created', 'authorized', 'captured', 'failed', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Orders
CREATE TABLE IF NOT EXISTS "orders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_number" text NOT NULL UNIQUE,
  "user_id" text NOT NULL,
  "status" "order_status" NOT NULL DEFAULT 'pending_payment',
  "shipping_address" jsonb NOT NULL,
  "subtotal" numeric(10, 2) NOT NULL,
  "discount_amount" numeric(10, 2) NOT NULL DEFAULT '0',
  "shipping_charge" numeric(10, 2) NOT NULL DEFAULT '0',
  "tax_amount" numeric(10, 2) NOT NULL DEFAULT '0',
  "total" numeric(10, 2) NOT NULL,
  "coupon_id" uuid,
  "coupon_code" text,
  "razorpay_order_id" text,
  "razorpay_payment_id" text,
  "delhivery_waybill" text,
  "tracking_url" text,
  "gst_invoice_number" text,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "orders_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict,
  CONSTRAINT "orders_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE set null
);

CREATE INDEX IF NOT EXISTS "orders_user_idx" ON "orders" ("user_id");
CREATE INDEX IF NOT EXISTS "orders_status_idx" ON "orders" ("status");
CREATE INDEX IF NOT EXISTS "orders_razorpay_order_idx" ON "orders" ("razorpay_order_id");

-- Order items
CREATE TABLE IF NOT EXISTS "order_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL,
  "variant_id" uuid,
  "product_name" text NOT NULL,
  "variant_sku" text NOT NULL,
  "size_ml" integer NOT NULL,
  "unit_price" numeric(10, 2) NOT NULL,
  "mrp" numeric(10, 2) NOT NULL,
  "quantity" integer NOT NULL,
  "line_total" numeric(10, 2) NOT NULL,
  "image_url" text,
  CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade,
  CONSTRAINT "order_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE set null
);

CREATE INDEX IF NOT EXISTS "order_items_order_idx" ON "order_items" ("order_id");

-- Order status history (append-only)
CREATE TABLE IF NOT EXISTS "order_status_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL,
  "from_status" "order_status",
  "to_status" "order_status" NOT NULL,
  "note" text,
  "actor_id" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "order_status_history_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS "order_status_history_order_idx" ON "order_status_history" ("order_id");

-- Payment attempts (append-only)
CREATE TABLE IF NOT EXISTS "payment_attempts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL,
  "gateway" "payment_gateway" NOT NULL DEFAULT 'razorpay',
  "gateway_order_id" text,
  "gateway_payment_id" text,
  "status" "payment_attempt_status" NOT NULL DEFAULT 'created',
  "amount" numeric(10, 2) NOT NULL,
  "raw_response" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "payment_attempts_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS "payment_attempts_order_idx" ON "payment_attempts" ("order_id");
CREATE INDEX IF NOT EXISTS "payment_attempts_gateway_order_idx" ON "payment_attempts" ("gateway_order_id");
