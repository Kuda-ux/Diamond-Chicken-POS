-- Migration 004: Recipe-based inventory (ingredients → menu items)
--
-- Adds three tables:
--   * ingredients         — raw materials (chicken pieces, oil, salt, boxes, etc.)
--   * recipes             — per-menu-item bill of materials
--   * ingredient_receipts — audit trail of ingredient deliveries
--
-- The existing per-menu-item `inventory` table is left intact for backward
-- compatibility. The order flow prefers a recipe deduction; if a menu item
-- has no recipe rows, it falls back to deducting the menu_items inventory.
--
-- Idempotent: safe to re-run.

-- 1. Ingredients (raw materials with their own stock)
CREATE TABLE IF NOT EXISTS ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL UNIQUE,
  unit VARCHAR(20) NOT NULL DEFAULT 'pcs',          -- e.g. 'pcs', 'g', 'ml', 'each'
  quantity NUMERIC(14,3) NOT NULL DEFAULT 0,        -- current stock (supports fractions: 1.5kg)
  low_stock_threshold NUMERIC(14,3) NOT NULL DEFAULT 10,
  unit_cost NUMERIC(12,4),                          -- average cost per unit (optional)
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ingredients_active ON ingredients(is_active);

-- 2. Recipes: per menu item, list of ingredients consumed per single unit sold
CREATE TABLE IF NOT EXISTS recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
  quantity_per_unit NUMERIC(14,3) NOT NULL CHECK (quantity_per_unit > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (menu_item_id, ingredient_id)
);

CREATE INDEX IF NOT EXISTS idx_recipes_menu_item ON recipes(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_recipes_ingredient ON recipes(ingredient_id);

-- 3. Ingredient deliveries / receipts (audit trail)
CREATE TABLE IF NOT EXISTS ingredient_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
  received_at DATE NOT NULL DEFAULT CURRENT_DATE,
  received_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  supplier VARCHAR(150),
  unit_cost NUMERIC(12,4),
  notes TEXT,
  batch_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ingredient_receipts_date ON ingredient_receipts(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_ingredient_receipts_batch ON ingredient_receipts(batch_id);
