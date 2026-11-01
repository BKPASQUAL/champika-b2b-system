-- Product Family replaces Model / Sub Model on the product form.
-- Run once in the Supabase SQL editor BEFORE deploying the code.

BEGIN;

-- 1. New column on products (old model_type / sub_model columns are kept, just hidden)
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_family text;

-- 2. Specs that were linked under a Model / Sub Model are moved up to that
--    model's sub category (or category), so they still show in the product form.
UPDATE categories s
SET parent_id = COALESCE(m.category_id, pm.category_id)
FROM categories m
LEFT JOIN categories pm ON pm.id = m.parent_id
WHERE s.type = 'spec'
  AND m.type = 'model'
  AND s.parent_id = m.id
  AND COALESCE(m.category_id, pm.category_id) IS NOT NULL;

-- 3. The move creates duplicate spec names under the same sub category
--    (e.g. "100m" was under both Blue and Brown). Keep the oldest one.
--    Products store the spec as text, so nothing that uses them breaks.
DELETE FROM categories c
USING (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY parent_id, lower(trim(name))
           ORDER BY created_at, id
         ) AS rn
  FROM categories
  WHERE type = 'spec'
) d
WHERE c.id = d.id
  AND d.rn > 1;

COMMIT;
