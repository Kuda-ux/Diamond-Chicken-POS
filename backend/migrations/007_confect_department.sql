-- Migration 007: Add Confect department for pies, cakes and related products
-- Also adds department column to ingredients for grouping in reconciliation.
-- Idempotent: safe to re-run.

-- 1. Add 'Confect' menu category (for pies, cakes, etc.)
INSERT INTO categories (name, icon, sort_order, is_active)
VALUES ('Confect', '🥧', 6, true)
ON CONFLICT DO NOTHING;

-- 2. Add department column to ingredients for grouping
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS department VARCHAR(60) DEFAULT 'Kitchen';
