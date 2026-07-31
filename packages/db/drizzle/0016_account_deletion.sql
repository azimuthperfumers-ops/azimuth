CREATE TABLE "account_deletions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"original_email" text NOT NULL,
	"original_name" text,
	"original_phone" text,
	"wallet_balance" numeric(10, 2) DEFAULT '0' NOT NULL,
	"order_count" integer DEFAULT 0 NOT NULL,
	"reason" text,
	"ip_address" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "account_deletions" ADD CONSTRAINT "account_deletions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_deletions_user_idx" ON "account_deletions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "account_deletions_created_idx" ON "account_deletions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "account_deletions_email_idx" ON "account_deletions" USING btree ("original_email");