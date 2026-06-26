-- Packed shipping box dimensions per variant (outer corrugated box dimensions, NOT bottle dimensions)
-- Used for Delhivery volumetric weight: (L × W × H) / 5000
ALTER TABLE "product_variants"
  ADD COLUMN IF NOT EXISTS "box_length_cm" integer,
  ADD COLUMN IF NOT EXISTS "box_width_cm" integer,
  ADD COLUMN IF NOT EXISTS "box_height_cm" integer;
