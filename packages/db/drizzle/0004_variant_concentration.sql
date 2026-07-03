ALTER TABLE "product_variants" ADD COLUMN "concentration" "product_concentration";--> statement-breakpoint
UPDATE "product_variants" pv SET "concentration" = p."concentration" FROM "products" p WHERE p."id" = pv."product_id";--> statement-breakpoint
ALTER TABLE "product_variants" ALTER COLUMN "concentration" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "concentration";
