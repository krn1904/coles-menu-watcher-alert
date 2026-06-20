-- Manual category overrides (public write — lets the site UI recategorise products).
CREATE TABLE IF NOT EXISTS deal_category_overrides (
  deal_id UUID PRIMARY KEY REFERENCES deals(id) ON DELETE CASCADE,
  display_category TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE deal_category_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read category overrides" ON deal_category_overrides
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert category overrides" ON deal_category_overrides
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update category overrides" ON deal_category_overrides
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete category overrides" ON deal_category_overrides
  FOR DELETE USING (true);

CREATE INDEX IF NOT EXISTS idx_deal_category_overrides_category ON deal_category_overrides(display_category);
