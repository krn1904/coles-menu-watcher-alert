-- Ensure scraper upserts can address one deal per store/product/week.
UPDATE deals
SET store = COALESCE(store, 'coles'),
    product_id = COALESCE(product_id, 'legacy_' || id::text),
    week_start = COALESCE(week_start, DATE(created_at), CURRENT_DATE)
WHERE store IS NULL
   OR product_id IS NULL
   OR week_start IS NULL;

ALTER TABLE deals
  ALTER COLUMN store SET NOT NULL,
  ALTER COLUMN product_id SET NOT NULL,
  ALTER COLUMN week_start SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_deals_store_product_week
  ON deals(store, product_id, week_start);

DROP POLICY IF EXISTS "Allow public insert to deals" ON deals;
DROP POLICY IF EXISTS "Allow public update to deals" ON deals;
