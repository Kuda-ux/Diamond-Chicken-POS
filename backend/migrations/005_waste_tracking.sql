-- Waste tracking table
CREATE TABLE IF NOT EXISTS waste_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id UUID NOT NULL REFERENCES ingredients(id),
  quantity NUMERIC(12,3) NOT NULL DEFAULT 0,
  reason TEXT,
  recorded_by_user_id UUID REFERENCES users(id),
  recorded_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_waste_records_ingredient ON waste_records(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_waste_records_date ON waste_records(recorded_at);
