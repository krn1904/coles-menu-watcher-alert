-- Add new columns to deals table for multi-store support
ALTER TABLE deals 
ADD COLUMN IF NOT EXISTS store TEXT,
ADD COLUMN IF NOT EXISTS product_id TEXT,
ADD COLUMN IF NOT EXISTS week_start DATE,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create fetch_logs table for rate limiting
CREATE TABLE IF NOT EXISTS fetch_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  message TEXT,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Update existing deals to be Woolworths data (for migration)
UPDATE deals 
SET store = 'woolworths', 
    product_id = 'legacy_' || id::text,
    week_start = DATE(created_at)
WHERE store IS NULL;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_deals_store ON deals(store);
CREATE INDEX IF NOT EXISTS idx_deals_product_id ON deals(product_id);
CREATE INDEX IF NOT EXISTS idx_deals_week_start ON deals(week_start);
CREATE INDEX IF NOT EXISTS idx_fetch_logs_store_created ON fetch_logs(store, created_at DESC);

-- Update RLS policies
DROP POLICY IF EXISTS "Allow public read access to deals" ON deals;
CREATE POLICY "Allow public read access to deals" ON deals
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert to subscriptions" ON subscriptions;
CREATE POLICY "Allow public insert to subscriptions" ON subscriptions
  FOR INSERT WITH CHECK (true);

-- Add policy for fetch_logs
ALTER TABLE fetch_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public insert to fetch_logs" ON fetch_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read access to fetch_logs" ON fetch_logs
  FOR SELECT USING (true);
