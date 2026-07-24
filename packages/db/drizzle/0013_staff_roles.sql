CREATE TYPE "public"."staff_role" AS ENUM('owner', 'orders_manager', 'cataloging', 'accounts', 'support');--> statement-breakpoint
CREATE TYPE "public"."staff_audit_action" AS ENUM('staff_created', 'role_changed', 'staff_removed', 'password_reset');--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "staff_role" "staff_role";--> statement-breakpoint
CREATE TABLE "staff_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" "staff_audit_action" NOT NULL,
	"actor_id" text,
	"actor_email" text,
	"target_user_id" text,
	"target_email" text NOT NULL,
	"from_role" "staff_role",
	"to_role" "staff_role",
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "staff_audit" ADD CONSTRAINT "staff_audit_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_audit" ADD CONSTRAINT "staff_audit_target_user_id_user_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "staff_audit_created_idx" ON "staff_audit" USING btree ("created_at");--> statement-breakpoint
-- Every existing admin becomes an owner so nobody loses access on deploy.
UPDATE "user" SET "staff_role" = 'owner' WHERE "role" = 'admin' AND "staff_role" IS NULL;
