-- Product image seed — picsum.photos with per-product seed strings (3:4 ratio).
-- imageUrl() in catalog.service.ts detects https:// and returns key as-is.
-- Deletes existing primary images for these products first, then re-inserts.

-- Remove stale/broken primary images for all seeded products
DELETE FROM public.product_images
WHERE product_id IN (
  '0eaf3bcc-1b33-4727-a685-279cc93c7dfc',
  'fe51439d-ab11-43fa-86af-18f5dd9dafce',
  'a2b3c4d5-e6f7-8901-bcde-f12345678901',
  'aa000001-0000-4000-8000-000000000001',
  'aa000002-0000-4000-8000-000000000002',
  'aa000003-0000-4000-8000-000000000003',
  'aa000004-0000-4000-8000-000000000004',
  'aa000005-0000-4000-8000-000000000005',
  'aa000006-0000-4000-8000-000000000006',
  'aa000007-0000-4000-8000-000000000007',
  'aa000008-0000-4000-8000-000000000008'
)
AND is_primary = true;

INSERT INTO public.product_images (id, product_id, key, alt_text, sort_order, is_primary, created_at) VALUES

  -- Solene (women · warm rose)
  (gen_random_uuid(),
   '0eaf3bcc-1b33-4727-a685-279cc93c7dfc',
   'https://picsum.photos/seed/az-solene/600/800',
   'Solene', 0, true, NOW()),

  -- Carlton 609 (men · woody amber)
  (gen_random_uuid(),
   'fe51439d-ab11-43fa-86af-18f5dd9dafce',
   'https://picsum.photos/seed/az-carlton609/600/800',
   'Carlton 609', 0, true, NOW()),

  -- Lumière Noire (unisex · night)
  (gen_random_uuid(),
   'a2b3c4d5-e6f7-8901-bcde-f12345678901',
   'https://picsum.photos/seed/az-lumiere-noire/600/800',
   'Lumière Noire', 0, true, NOW()),

  -- Monsoon Mitti (unisex · earthy)
  (gen_random_uuid(),
   'aa000001-0000-4000-8000-000000000001',
   'https://picsum.photos/seed/az-monsoon-mitti/600/800',
   'Monsoon Mitti', 0, true, NOW()),

  -- Raat Rani (women · floral night)
  (gen_random_uuid(),
   'aa000002-0000-4000-8000-000000000002',
   'https://picsum.photos/seed/az-raat-rani/600/800',
   'Raat Rani', 0, true, NOW()),

  -- Kesar Oud (men · saffron)
  (gen_random_uuid(),
   'aa000003-0000-4000-8000-000000000003',
   'https://picsum.photos/seed/az-kesar-oud/600/800',
   'Kesar Oud', 0, true, NOW()),

  -- Shaam-e-Awadh (men · golden)
  (gen_random_uuid(),
   'aa000004-0000-4000-8000-000000000004',
   'https://picsum.photos/seed/az-shaam-e-awadh/600/800',
   'Shaam-e-Awadh', 0, true, NOW()),

  -- Vetiver Noir (unisex · dark)
  (gen_random_uuid(),
   'aa000005-0000-4000-8000-000000000005',
   'https://picsum.photos/seed/az-vetiver-noir/600/800',
   'Vetiver Noir', 0, true, NOW()),

  -- Gulabi Hawa (women · pink floral)
  (gen_random_uuid(),
   'aa000006-0000-4000-8000-000000000006',
   'https://picsum.photos/seed/az-gulabi-hawa/600/800',
   'Gulabi Hawa', 0, true, NOW()),

  -- Amber Coast (unisex · coastal)
  (gen_random_uuid(),
   'aa000007-0000-4000-8000-000000000007',
   'https://picsum.photos/seed/az-amber-coast/600/800',
   'Amber Coast', 0, true, NOW()),

  -- Noir Tabac (men · dark decadent)
  (gen_random_uuid(),
   'aa000008-0000-4000-8000-000000000008',
   'https://picsum.photos/seed/az-noir-tabac/600/800',
   'Noir Tabac', 0, true, NOW());
