-- Create delay_reasons table for analytics
CREATE TABLE IF NOT EXISTS delay_reasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL,
  item_id TEXT,
  category TEXT NOT NULL CHECK (category IN ('design', 'client', 'prepress', 'production', 'outsource_vendor', 'material', 'internal_process')),
  reason TEXT NOT NULL,
  description TEXT,
  stage TEXT NOT NULL,
  reported_by TEXT NOT NULL,
  reported_by_name TEXT NOT NULL,
  reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_delay_reasons_order_id ON delay_reasons(order_id);
CREATE INDEX IF NOT EXISTS idx_delay_reasons_item_id ON delay_reasons(item_id);
CREATE INDEX IF NOT EXISTS idx_delay_reasons_reported_at ON delay_reasons(reported_at DESC);
CREATE INDEX IF NOT EXISTS idx_delay_reasons_order_item ON delay_reasons(order_id, item_id);
CREATE INDEX IF NOT EXISTS idx_delay_reasons_category ON delay_reasons(category);
CREATE INDEX IF NOT EXISTS idx_delay_reasons_stage ON delay_reasons(stage);

-- Enable RLS
ALTER TABLE delay_reasons ENABLE ROW LEVEL SECURITY;

-- RLS Policies: All authenticated users can read delay reasons
CREATE POLICY "Users can view delay reasons" ON delay_reasons
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- RLS Policies: All authenticated users can insert delay reasons
CREATE POLICY "Users can insert delay reasons" ON delay_reasons
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- RLS Policies: Users can update their own reported delay reasons or admins can update any
CREATE POLICY "Users can update delay reasons" ON delay_reasons
  FOR UPDATE
  USING (
    auth.uid()::text = reported_by OR
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()::text
      AND user_roles.role = 'admin'
    )
  );

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_delay_reasons_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_delay_reasons_updated_at
  BEFORE UPDATE ON delay_reasons
  FOR EACH ROW
  EXECUTE FUNCTION update_delay_reasons_updated_at();

