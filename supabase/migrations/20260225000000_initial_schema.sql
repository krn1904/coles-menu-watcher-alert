-- Create deals table
CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT,
  original_price NUMERIC NOT NULL,
  sale_price NUMERIC NOT NULL,
  discount_percentage INTEGER,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  categories TEXT[],
  min_discount INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_deals_created_at ON deals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deals_category ON deals(category);
CREATE INDEX IF NOT EXISTS idx_subscriptions_email ON subscriptions(email);

-- Enable Row Level Security (RLS)
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access to deals
CREATE POLICY "Allow public read access to deals" ON deals
  FOR SELECT USING (true);

-- Create policies for public insert access to subscriptions
CREATE POLICY "Allow public insert to subscriptions" ON subscriptions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read own subscription" ON subscriptions
  FOR SELECT USING (true);
