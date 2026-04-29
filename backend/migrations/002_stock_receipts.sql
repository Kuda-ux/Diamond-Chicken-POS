-- Stock receipts: weekly batches of goods received from suppliers.
-- Each receipt logs an audit row AND increments inventory.quantity (handled in code, atomically).
CREATE TABLE IF NOT EXISTS stock_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  quantity INT NOT NULL CHECK (quantity > 0),
  received_at DATE NOT NULL DEFAULT CURRENT_DATE,
  received_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  supplier VARCHAR(150),
  unit_cost DECIMAL(10,2),
  notes TEXT,
  batch_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_receipts_received_at ON stock_receipts(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_receipts_menu_item ON stock_receipts(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_stock_receipts_batch ON stock_receipts(batch_id);
