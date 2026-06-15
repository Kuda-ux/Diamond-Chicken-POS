-- Migration 006: Stock reconciliation support
-- Adds stock_counts table for recording physical counts and opening snapshots.
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS stock_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  count_date DATE NOT NULL DEFAULT CURRENT_DATE,
  quantity NUMERIC(14,3) NOT NULL DEFAULT 0,
  counted_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ingredient_id, count_date)
);

CREATE INDEX IF NOT EXISTS idx_stock_counts_date ON stock_counts(count_date DESC);
CREATE INDEX IF NOT EXISTS idx_stock_counts_ingredient ON stock_counts(ingredient_id);
