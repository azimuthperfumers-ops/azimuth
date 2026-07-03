-- Extra perfumes seed — 8 products, mix of 1 and 2 variants.
-- Uses proper UUID v4 format (3rd group 4xxx, 4th group [89ab]xxx).
-- Cleans up any previous bad-UUID rows first, then inserts.

-- ── Remove old bad-UUID rows (0000 version group) ───────────────────────────

DELETE FROM public.products WHERE id IN (
  'aa000001-0000-0000-0000-000000000001',
  'aa000002-0000-0000-0000-000000000002',
  'aa000003-0000-0000-0000-000000000003',
  'aa000004-0000-0000-0000-000000000004',
  'aa000005-0000-0000-0000-000000000005',
  'aa000006-0000-0000-0000-000000000006',
  'aa000007-0000-0000-0000-000000000007',
  'aa000008-0000-0000-0000-000000000008'
);

-- ── Products ──────────────────────────────────────────────────────────────────

INSERT INTO public.products (
  id, name, slug, description, gender,
  theme_color, category_id, hsn_code,
  longevity_rating, sillage_rating, status, is_featured,
  created_at, updated_at
) VALUES

  -- 1. Monsoon Mitti  (unisex · EDP · 1 variant)
  (
    'aa000001-0000-4000-8000-000000000001',
    'Monsoon Mitti',
    'monsoon-mitti',
    'The first rain on dry earth. Petrichor, wet clay, and a heart of green vetiver with a soft woody drydown — worn memory of an Indian summer broken.',
    'unisex', '#6b7c5e',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    '3303', 4, 3, 'active', true, NOW(), NOW()
  ),

  -- 2. Raat Rani  (women · EDP · 2 variants)
  (
    'aa000002-0000-4000-8000-000000000002',
    'Raat Rani',
    'raat-rani',
    'Night-blooming Cestrum Nocturnum — intoxicating and white-floral, sweetened by tuberose and anchored with warm sandalwood. Made for evenings that linger.',
    'women', '#4a3060',
    '64a11837-a4ef-43a2-b9e9-b3eb92c10e3b',
    '3303', 5, 5, 'active', true, NOW(), NOW()
  ),

  -- 3. Kesar Oud  (men · EDP · 1 variant)
  (
    'aa000003-0000-4000-8000-000000000003',
    'Kesar Oud',
    'kesar-oud',
    'Saffron threads over aged Hindi oud — opulent, deep, and unhurried. A fragrance that commands presence without a word.',
    'men', '#8b4513',
    '670ac55d-1ced-43be-bea2-8fc7c42b3f9e',
    '3303', 5, 5, 'active', false, NOW(), NOW()
  ),

  -- 4. Shaam-e-Awadh  (men · cologne · 2 variants)
  (
    'aa000004-0000-4000-8000-000000000004',
    'Shaam-e-Awadh',
    'shaam-e-awadh',
    'Lucknow at dusk — jasmine garlands, a breath of incense from passing diyas, and the warmth of aged wood. Cultured. Unhurried. Eternal.',
    'men', '#c8960c',
    '670ac55d-1ced-43be-bea2-8fc7c42b3f9e',
    '3303', 3, 4, 'active', true, NOW(), NOW()
  ),

  -- 5. Vetiver Noir  (unisex · EDP · 1 variant)
  (
    'aa000005-0000-4000-8000-000000000005',
    'Vetiver Noir',
    'vetiver-noir',
    'Dark, smoked vetiver rooted in black pepper and birch tar — dry and resinous, yet surprisingly skin-close. For those who find complexity in restraint.',
    'unisex', '#1a1a1a',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    '3303', 5, 3, 'active', false, NOW(), NOW()
  ),

  -- 6. Gulabi Hawa  (women · EDP · 2 variants)
  (
    'aa000006-0000-4000-8000-000000000006',
    'Gulabi Hawa',
    'gulabi-hawa',
    'Pink wind through a rose garden at dawn. Bright bergamot and dewy peony give way to a soft rose heart, drying down to clean musk and white cedar.',
    'women', '#e8a0a0',
    '64a11837-a4ef-43a2-b9e9-b3eb92c10e3b',
    '3303', 3, 3, 'active', true, NOW(), NOW()
  ),

  -- 7. Amber Coast  (unisex · EDP · 2 variants)
  (
    'aa000007-0000-4000-8000-000000000007',
    'Amber Coast',
    'amber-coast',
    'Sea salt and ambergris washed onto warm amber resin. A coastal fragrance with depth — aquatic freshness on top, ancient ocean on the base.',
    'unisex', '#c8a96e',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    '3303', 4, 4, 'active', false, NOW(), NOW()
  ),

  -- 8. Noir Tabac  (men · parfum · 1 variant)
  (
    'aa000008-0000-4000-8000-000000000008',
    'Noir Tabac',
    'noir-tabac',
    'Cured tobacco leaf, tonka bean, and a touch of caramel over dark patchouli. Heady and decadent — the kind of scent that fills a room with intent.',
    'men', '#2d1b0e',
    '670ac55d-1ced-43be-bea2-8fc7c42b3f9e',
    '3303', 5, 5, 'active', true, NOW(), NOW()
  )

ON CONFLICT (id) DO NOTHING;

-- ── Variants ──────────────────────────────────────────────────────────────────

INSERT INTO public.product_variants (
  id, product_id, sku, concentration, size_ml, mrp, selling_price,
  weight_grams, stock_cached, is_default, status,
  created_at, updated_at
) VALUES

  -- Monsoon Mitti · 50ml only
  ('bb000001-0000-4000-8000-000000000001', 'aa000001-0000-4000-8000-000000000001',
   'AZ-MMIT-50',  'edp', 50, 1350.00, 1150.00, 1200, 80, true,  'active', NOW(), NOW()),

  -- Raat Rani · 50ml + 100ml
  ('bb000002-0000-4000-8000-000000000001', 'aa000002-0000-4000-8000-000000000002',
   'AZ-RAAT-50',  'edp', 50, 1450.00, 1199.00, 1200, 60, true,  'active', NOW(), NOW()),
  ('bb000002-0000-4000-8000-000000000002', 'aa000002-0000-4000-8000-000000000002',
   'AZ-RAAT-100', 'edp', 100, 2650.00, 2199.00, 2000, 30, false, 'active', NOW(), NOW()),

  -- Kesar Oud · 50ml only
  ('bb000003-0000-4000-8000-000000000001', 'aa000003-0000-4000-8000-000000000003',
   'AZ-KSOU-50',  'edp', 50, 2200.00, 1899.00, 1200, 40, true,  'active', NOW(), NOW()),

  -- Shaam-e-Awadh · 50ml + 100ml
  ('bb000004-0000-4000-8000-000000000001', 'aa000004-0000-4000-8000-000000000004',
   'AZ-SHAW-50',  'cologne', 50,  999.00,  849.00, 1150, 100, true,  'active', NOW(), NOW()),
  ('bb000004-0000-4000-8000-000000000002', 'aa000004-0000-4000-8000-000000000004',
   'AZ-SHAW-100', 'cologne', 100, 1799.00, 1499.00, 1950, 50, false, 'active', NOW(), NOW()),

  -- Vetiver Noir · 50ml only
  ('bb000005-0000-4000-8000-000000000001', 'aa000005-0000-4000-8000-000000000005',
   'AZ-VTNR-50',  'edp', 50, 1600.00, 1350.00, 1200, 45, true,  'active', NOW(), NOW()),

  -- Gulabi Hawa · 30ml + 50ml
  ('bb000006-0000-4000-8000-000000000001', 'aa000006-0000-4000-8000-000000000006',
   'AZ-GULH-30',  'edp', 30,  750.00,  649.00,  800, 90, true,  'active', NOW(), NOW()),
  ('bb000006-0000-4000-8000-000000000002', 'aa000006-0000-4000-8000-000000000006',
   'AZ-GULH-50',  'edp', 50, 1150.00,  999.00, 1200, 60, false, 'active', NOW(), NOW()),

  -- Amber Coast · 50ml + 100ml
  ('bb000007-0000-4000-8000-000000000001', 'aa000007-0000-4000-8000-000000000007',
   'AZ-AMBC-50',  'edp', 50, 1500.00, 1249.00, 1200, 55, true,  'active', NOW(), NOW()),
  ('bb000007-0000-4000-8000-000000000002', 'aa000007-0000-4000-8000-000000000007',
   'AZ-AMBC-100', 'edp', 100, 2750.00, 2299.00, 2000, 25, false, 'active', NOW(), NOW()),

  -- Noir Tabac · 50ml only
  ('bb000008-0000-4000-8000-000000000001', 'aa000008-0000-4000-8000-000000000008',
   'AZ-NTAB-50',  'parfum', 50, 2500.00, 2099.00, 1200, 30, true,  'active', NOW(), NOW())

ON CONFLICT (id) DO NOTHING;

-- ── Fragrance notes ───────────────────────────────────────────────────────────

INSERT INTO public.product_notes (id, product_id, note_id, note_position, sort_order) VALUES

  -- Monsoon Mitti
  (gen_random_uuid(), 'aa000001-0000-4000-8000-000000000001', 'f1000001-0000-0000-0000-000000000033', 'top',  1),
  (gen_random_uuid(), 'aa000001-0000-4000-8000-000000000001', 'f1000001-0000-0000-0000-000000000031', 'top',  2),
  (gen_random_uuid(), 'aa000001-0000-4000-8000-000000000001', 'f1000001-0000-0000-0000-000000000014', 'mid',  1),
  (gen_random_uuid(), 'aa000001-0000-4000-8000-000000000001', 'f1000001-0000-0000-0000-000000000015', 'mid',  2),
  (gen_random_uuid(), 'aa000001-0000-4000-8000-000000000001', 'f1000001-0000-0000-0000-000000000011', 'base', 1),
  (gen_random_uuid(), 'aa000001-0000-4000-8000-000000000001', 'f1000001-0000-0000-0000-000000000071', 'base', 2),

  -- Raat Rani
  (gen_random_uuid(), 'aa000002-0000-4000-8000-000000000002', 'f1000001-0000-0000-0000-000000000044', 'top',  1),
  (gen_random_uuid(), 'aa000002-0000-4000-8000-000000000002', 'f1000001-0000-0000-0000-000000000006', 'top',  2),
  (gen_random_uuid(), 'aa000002-0000-4000-8000-000000000002', 'f1000001-0000-0000-0000-000000000004', 'mid',  1),
  (gen_random_uuid(), 'aa000002-0000-4000-8000-000000000002', 'f1000001-0000-0000-0000-000000000002', 'mid',  2),
  (gen_random_uuid(), 'aa000002-0000-4000-8000-000000000002', 'f1000001-0000-0000-0000-000000000012', 'base', 1),
  (gen_random_uuid(), 'aa000002-0000-4000-8000-000000000002', 'f1000001-0000-0000-0000-000000000022', 'base', 2),

  -- Kesar Oud
  (gen_random_uuid(), 'aa000003-0000-4000-8000-000000000003', 'f1000001-0000-0000-0000-000000000041', 'top',  1),
  (gen_random_uuid(), 'aa000003-0000-4000-8000-000000000003', 'f1000001-0000-0000-0000-000000000023', 'mid',  1),
  (gen_random_uuid(), 'aa000003-0000-4000-8000-000000000003', 'f1000001-0000-0000-0000-000000000021', 'mid',  2),
  (gen_random_uuid(), 'aa000003-0000-4000-8000-000000000003', 'f1000001-0000-0000-0000-000000000013', 'base', 1),
  (gen_random_uuid(), 'aa000003-0000-4000-8000-000000000003', 'f1000001-0000-0000-0000-000000000012', 'base', 2),

  -- Shaam-e-Awadh
  (gen_random_uuid(), 'aa000004-0000-4000-8000-000000000004', 'f1000001-0000-0000-0000-000000000043', 'top',  1),
  (gen_random_uuid(), 'aa000004-0000-4000-8000-000000000004', 'f1000001-0000-0000-0000-000000000002', 'mid',  1),
  (gen_random_uuid(), 'aa000004-0000-4000-8000-000000000004', 'f1000001-0000-0000-0000-000000000023', 'mid',  2),
  (gen_random_uuid(), 'aa000004-0000-4000-8000-000000000004', 'f1000001-0000-0000-0000-000000000011', 'base', 1),
  (gen_random_uuid(), 'aa000004-0000-4000-8000-000000000004', 'f1000001-0000-0000-0000-000000000021', 'base', 2),

  -- Vetiver Noir
  (gen_random_uuid(), 'aa000005-0000-4000-8000-000000000005', 'f1000001-0000-0000-0000-000000000042', 'top',  1),
  (gen_random_uuid(), 'aa000005-0000-4000-8000-000000000005', 'f1000001-0000-0000-0000-000000000014', 'mid',  1),
  (gen_random_uuid(), 'aa000005-0000-4000-8000-000000000005', 'f1000001-0000-0000-0000-000000000015', 'mid',  2),
  (gen_random_uuid(), 'aa000005-0000-4000-8000-000000000005', 'f1000001-0000-0000-0000-000000000024', 'base', 1),
  (gen_random_uuid(), 'aa000005-0000-4000-8000-000000000005', 'f1000001-0000-0000-0000-000000000072', 'base', 2),

  -- Gulabi Hawa
  (gen_random_uuid(), 'aa000006-0000-4000-8000-000000000006', 'f1000001-0000-0000-0000-000000000041', 'top',  1),
  (gen_random_uuid(), 'aa000006-0000-4000-8000-000000000006', 'f1000001-0000-0000-0000-000000000006', 'top',  2),
  (gen_random_uuid(), 'aa000006-0000-4000-8000-000000000006', 'f1000001-0000-0000-0000-000000000001', 'mid',  1),
  (gen_random_uuid(), 'aa000006-0000-4000-8000-000000000006', 'f1000001-0000-0000-0000-000000000005', 'mid',  2),
  (gen_random_uuid(), 'aa000006-0000-4000-8000-000000000006', 'f1000001-0000-0000-0000-000000000011', 'base', 1),
  (gen_random_uuid(), 'aa000006-0000-4000-8000-000000000006', 'f1000001-0000-0000-0000-000000000072', 'base', 2),

  -- Amber Coast
  (gen_random_uuid(), 'aa000007-0000-4000-8000-000000000007', 'f1000001-0000-0000-0000-000000000051', 'top',  1),
  (gen_random_uuid(), 'aa000007-0000-4000-8000-000000000007', 'f1000001-0000-0000-0000-000000000043', 'top',  2),
  (gen_random_uuid(), 'aa000007-0000-4000-8000-000000000007', 'f1000001-0000-0000-0000-000000000052', 'mid',  1),
  (gen_random_uuid(), 'aa000007-0000-4000-8000-000000000007', 'f1000001-0000-0000-0000-000000000053', 'mid',  2),
  (gen_random_uuid(), 'aa000007-0000-4000-8000-000000000007', 'f1000001-0000-0000-0000-000000000021', 'base', 1),
  (gen_random_uuid(), 'aa000007-0000-4000-8000-000000000007', 'f1000001-0000-0000-0000-000000000071', 'base', 2),

  -- Noir Tabac
  (gen_random_uuid(), 'aa000008-0000-4000-8000-000000000008', 'f1000001-0000-0000-0000-000000000063', 'top',  1),
  (gen_random_uuid(), 'aa000008-0000-4000-8000-000000000008', 'f1000001-0000-0000-0000-000000000061', 'mid',  1),
  (gen_random_uuid(), 'aa000008-0000-4000-8000-000000000008', 'f1000001-0000-0000-0000-000000000015', 'mid',  2),
  (gen_random_uuid(), 'aa000008-0000-4000-8000-000000000008', 'f1000001-0000-0000-0000-000000000062', 'base', 1),
  (gen_random_uuid(), 'aa000008-0000-4000-8000-000000000008', 'f1000001-0000-0000-0000-000000000024', 'base', 2)

ON CONFLICT DO NOTHING;
