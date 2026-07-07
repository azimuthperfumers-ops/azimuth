-- Azimuth Perfumers seed data
-- Run after migrations. Safe to re-run (uses ON CONFLICT DO NOTHING).

-- Categories
INSERT INTO public.categories (id, name, slug, parent_id, sort_order, created_at, updated_at) VALUES
  ('64a11837-a4ef-43a2-b9e9-b3eb92c10e3b', 'For Her', 'for-her', NULL, 0, NOW(), NOW()),
  ('670ac55d-1ced-43be-bea2-8fc7c42b3f9e', 'For Him', 'for-him', NULL, 1, NOW(), NOW()),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Unisex',  'unisex',  NULL, 2, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Fragrance families (no timestamps in schema)
INSERT INTO public.fragrance_families (id, name) VALUES
  ('ff000001-0000-0000-0000-000000000001', 'Floral'),
  ('ff000001-0000-0000-0000-000000000002', 'Woody'),
  ('ff000001-0000-0000-0000-000000000003', 'Oriental'),
  ('ff000001-0000-0000-0000-000000000004', 'Fresh'),
  ('ff000001-0000-0000-0000-000000000005', 'Citrus'),
  ('ff000001-0000-0000-0000-000000000006', 'Aquatic'),
  ('ff000001-0000-0000-0000-000000000007', 'Gourmand'),
  ('ff000001-0000-0000-0000-000000000008', 'Chypre'),
  ('ff000001-0000-0000-0000-000000000009', 'Fougère'),
  ('ff000001-0000-0000-0000-000000000010', 'Musk')
ON CONFLICT (id) DO NOTHING;

-- Fragrance notes (no timestamps in schema)
INSERT INTO public.fragrance_notes (id, name, family_id) VALUES
  -- Floral
  ('f1000001-0000-0000-0000-000000000001', 'Rose',       'ff000001-0000-0000-0000-000000000001'),
  ('f1000001-0000-0000-0000-000000000002', 'Jasmine',    'ff000001-0000-0000-0000-000000000001'),
  ('f1000001-0000-0000-0000-000000000003', 'Ylang Ylang','ff000001-0000-0000-0000-000000000001'),
  ('f1000001-0000-0000-0000-000000000004', 'Tuberose',   'ff000001-0000-0000-0000-000000000001'),
  ('f1000001-0000-0000-0000-000000000005', 'Iris',       'ff000001-0000-0000-0000-000000000001'),
  ('f1000001-0000-0000-0000-000000000006', 'Peony',      'ff000001-0000-0000-0000-000000000001'),
  -- Woody
  ('f1000001-0000-0000-0000-000000000011', 'Cedarwood',  'ff000001-0000-0000-0000-000000000002'),
  ('f1000001-0000-0000-0000-000000000012', 'Sandalwood', 'ff000001-0000-0000-0000-000000000002'),
  ('f1000001-0000-0000-0000-000000000013', 'Oud',        'ff000001-0000-0000-0000-000000000002'),
  ('f1000001-0000-0000-0000-000000000014', 'Vetiver',    'ff000001-0000-0000-0000-000000000002'),
  ('f1000001-0000-0000-0000-000000000015', 'Patchouli',  'ff000001-0000-0000-0000-000000000002'),
  -- Oriental
  ('f1000001-0000-0000-0000-000000000021', 'Amber',      'ff000001-0000-0000-0000-000000000003'),
  ('f1000001-0000-0000-0000-000000000022', 'Vanilla',    'ff000001-0000-0000-0000-000000000003'),
  ('f1000001-0000-0000-0000-000000000023', 'Incense',    'ff000001-0000-0000-0000-000000000003'),
  ('f1000001-0000-0000-0000-000000000024', 'Benzoin',    'ff000001-0000-0000-0000-000000000003'),
  -- Fresh
  ('f1000001-0000-0000-0000-000000000031', 'Green Tea',  'ff000001-0000-0000-0000-000000000004'),
  ('f1000001-0000-0000-0000-000000000032', 'Mint',       'ff000001-0000-0000-0000-000000000004'),
  ('f1000001-0000-0000-0000-000000000033', 'Cucumber',   'ff000001-0000-0000-0000-000000000004'),
  -- Citrus
  ('f1000001-0000-0000-0000-000000000041', 'Bergamot',   'ff000001-0000-0000-0000-000000000005'),
  ('f1000001-0000-0000-0000-000000000042', 'Lemon',      'ff000001-0000-0000-0000-000000000005'),
  ('f1000001-0000-0000-0000-000000000043', 'Grapefruit', 'ff000001-0000-0000-0000-000000000005'),
  ('f1000001-0000-0000-0000-000000000044', 'Neroli',     'ff000001-0000-0000-0000-000000000005'),
  -- Aquatic
  ('f1000001-0000-0000-0000-000000000051', 'Sea Salt',   'ff000001-0000-0000-0000-000000000006'),
  ('f1000001-0000-0000-0000-000000000052', 'Ambergris',  'ff000001-0000-0000-0000-000000000006'),
  ('f1000001-0000-0000-0000-000000000053', 'Driftwood',  'ff000001-0000-0000-0000-000000000006'),
  -- Gourmand
  ('f1000001-0000-0000-0000-000000000061', 'Caramel',    'ff000001-0000-0000-0000-000000000007'),
  ('f1000001-0000-0000-0000-000000000062', 'Tonka Bean', 'ff000001-0000-0000-0000-000000000007'),
  ('f1000001-0000-0000-0000-000000000063', 'Coffee',     'ff000001-0000-0000-0000-000000000007'),
  -- Musk
  ('f1000001-0000-0000-0000-000000000071', 'White Musk', 'ff000001-0000-0000-0000-000000000010'),
  ('f1000001-0000-0000-0000-000000000072', 'Clean Musk', 'ff000001-0000-0000-0000-000000000010')
ON CONFLICT (id) DO NOTHING;

-- Products (Carlton 609 kept as canonical)
INSERT INTO public.products (id, name, slug, description, theme_color, category_id, hsn_code, longevity_rating, sillage_rating, status, is_featured, created_at, updated_at) VALUES
  (
    '0eaf3bcc-1b33-4727-a685-279cc93c7dfc',
    'Solene',
    'solene',
    'Warm and sensual — a veil of rose, ylang ylang, and sandalwood that lingers like skin. Made for those who let their presence speak first.',
    '#b07070',
    '64a11837-a4ef-43a2-b9e9-b3eb92c10e3b',
    '3303',
    4,
    4,
    'active',
    true,
    NOW(), NOW()
  ),
  (
    'fe51439d-ab11-43fa-86af-18f5dd9dafce',
    'Carlton 609',
    'carlton-609',
    'A bold, woody-amber cologne with a dry citrus open and a cedar-oud base. Confident, quiet authority in a bottle.',
    '#7a6240',
    '670ac55d-1ced-43be-bea2-8fc7c42b3f9e',
    '3303',
    3,
    5,
    'active',
    true,
    NOW(), NOW()
  ),
  (
    'a2b3c4d5-e6f7-8901-bcde-f12345678901',
    'Lumière Noire',
    'lumiere-noire',
    'A unisex night fragrance. Black pepper and bergamot spark over a heart of iris and oud, fading into white musk and tonka.',
    '#2c2c3e',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    '3303',
    5,
    4,
    'active',
    false,
    NOW(), NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- Variants
INSERT INTO public.product_variants (id, product_id, sku, concentration, size_ml, mrp, weight_grams, stock_cached, is_default, status, created_at, updated_at) VALUES
  -- Solene
  ('bdf06f07-06cd-44e4-8132-06e879c51215', '0eaf3bcc-1b33-4727-a685-279cc93c7dfc', 'AZ-SOLN-50',  'edp', 50,  1100.00, 1200, 150, true,  'active', NOW(), NOW()),
  ('bdf06f07-06cd-44e4-8132-06e879c51216', '0eaf3bcc-1b33-4727-a685-279cc93c7dfc', 'AZ-SOLN-100', 'edp', 100, 1900.00, 2000,  80, false, 'active', NOW(), NOW()),
  -- Carlton 609
  ('cf1a2b3c-4d5e-6f70-8901-234567890001', 'fe51439d-ab11-43fa-86af-18f5dd9dafce', 'AZ-C609-50',  'cologne', 50,   950.00, 1150,  60, true,  'active', NOW(), NOW()),
  ('cf1a2b3c-4d5e-6f70-8901-234567890002', 'fe51439d-ab11-43fa-86af-18f5dd9dafce', 'AZ-C609-100', 'cologne', 100, 1750.00, 1950,  40, false, 'active', NOW(), NOW()),
  -- Lumière Noire
  ('d1a2b3c4-4d5e-6f70-8901-234567890001', 'a2b3c4d5-e6f7-8901-bcde-f12345678901', 'AZ-LN-50',    'edp', 50,  1250.00, 1200,  35, true,  'active', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Product notes (top/mid/base — note_position enum, has own id column)
INSERT INTO public.product_notes (id, product_id, note_id, note_position, sort_order) VALUES
  -- Solene
  (gen_random_uuid(), '0eaf3bcc-1b33-4727-a685-279cc93c7dfc', 'f1000001-0000-0000-0000-000000000041', 'top', 1),  -- Bergamot
  (gen_random_uuid(), '0eaf3bcc-1b33-4727-a685-279cc93c7dfc', 'f1000001-0000-0000-0000-000000000006', 'top', 2),  -- Peony
  (gen_random_uuid(), '0eaf3bcc-1b33-4727-a685-279cc93c7dfc', 'f1000001-0000-0000-0000-000000000001', 'mid', 1),  -- Rose
  (gen_random_uuid(), '0eaf3bcc-1b33-4727-a685-279cc93c7dfc', 'f1000001-0000-0000-0000-000000000003', 'mid', 2),  -- Ylang Ylang
  (gen_random_uuid(), '0eaf3bcc-1b33-4727-a685-279cc93c7dfc', 'f1000001-0000-0000-0000-000000000012', 'base', 1), -- Sandalwood
  (gen_random_uuid(), '0eaf3bcc-1b33-4727-a685-279cc93c7dfc', 'f1000001-0000-0000-0000-000000000071', 'base', 2), -- White Musk
  -- Carlton 609
  (gen_random_uuid(), 'fe51439d-ab11-43fa-86af-18f5dd9dafce', 'f1000001-0000-0000-0000-000000000042', 'top', 1),  -- Lemon
  (gen_random_uuid(), 'fe51439d-ab11-43fa-86af-18f5dd9dafce', 'f1000001-0000-0000-0000-000000000041', 'top', 2),  -- Bergamot
  (gen_random_uuid(), 'fe51439d-ab11-43fa-86af-18f5dd9dafce', 'f1000001-0000-0000-0000-000000000005', 'mid', 1),  -- Iris
  (gen_random_uuid(), 'fe51439d-ab11-43fa-86af-18f5dd9dafce', 'f1000001-0000-0000-0000-000000000021', 'mid', 2),  -- Amber
  (gen_random_uuid(), 'fe51439d-ab11-43fa-86af-18f5dd9dafce', 'f1000001-0000-0000-0000-000000000013', 'base', 1), -- Oud
  (gen_random_uuid(), 'fe51439d-ab11-43fa-86af-18f5dd9dafce', 'f1000001-0000-0000-0000-000000000011', 'base', 2), -- Cedarwood
  -- Lumière Noire
  (gen_random_uuid(), 'a2b3c4d5-e6f7-8901-bcde-f12345678901', 'f1000001-0000-0000-0000-000000000043', 'top', 1),  -- Grapefruit
  (gen_random_uuid(), 'a2b3c4d5-e6f7-8901-bcde-f12345678901', 'f1000001-0000-0000-0000-000000000032', 'top', 2),  -- Mint
  (gen_random_uuid(), 'a2b3c4d5-e6f7-8901-bcde-f12345678901', 'f1000001-0000-0000-0000-000000000005', 'mid', 1),  -- Iris
  (gen_random_uuid(), 'a2b3c4d5-e6f7-8901-bcde-f12345678901', 'f1000001-0000-0000-0000-000000000013', 'mid', 2),  -- Oud
  (gen_random_uuid(), 'a2b3c4d5-e6f7-8901-bcde-f12345678901', 'f1000001-0000-0000-0000-000000000071', 'base', 1), -- White Musk
  (gen_random_uuid(), 'a2b3c4d5-e6f7-8901-bcde-f12345678901', 'f1000001-0000-0000-0000-000000000062', 'base', 2)  -- Tonka Bean
ON CONFLICT DO NOTHING;
