-- Persist manual categories by product SKU (survives weekly re-scrapes and new deal rows).
CREATE TABLE IF NOT EXISTS product_category_overrides (
  store TEXT NOT NULL,
  product_id TEXT NOT NULL,
  display_category TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (store, product_id)
);

ALTER TABLE product_category_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read product category overrides" ON product_category_overrides
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert product category overrides" ON product_category_overrides
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update product category overrides" ON product_category_overrides
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete product category overrides" ON product_category_overrides
  FOR DELETE USING (true);

CREATE INDEX IF NOT EXISTS idx_product_category_overrides_category
  ON product_category_overrides(display_category);

-- Migrate rows from deal_id-based overrides if that table exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'deal_category_overrides'
  ) THEN
    INSERT INTO product_category_overrides (store, product_id, display_category, updated_at)
    SELECT d.store, d.product_id, o.display_category, o.updated_at
    FROM deal_category_overrides o
    JOIN deals d ON d.id = o.deal_id
    WHERE d.store IS NOT NULL AND d.product_id IS NOT NULL
    ON CONFLICT (store, product_id) DO UPDATE
      SET display_category = EXCLUDED.display_category,
          updated_at = EXCLUDED.updated_at;

    DROP TABLE deal_category_overrides;
  END IF;
END $$;
