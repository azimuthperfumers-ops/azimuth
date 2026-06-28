ALTER TABLE "user_addresses" ADD COLUMN IF NOT EXISTS "lat" double precision;
ALTER TABLE "user_addresses" ADD COLUMN IF NOT EXISTS "lng" double precision;
