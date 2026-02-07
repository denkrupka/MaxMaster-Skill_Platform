-- =====================================================
-- Migration: Procurement Module (Zaopatrzenie)
-- Date: 2026-02-07
-- Description: Resource requests, orders, and stock management
-- =====================================================

-- 1. Resource Requests (заявки на ресурсы)
DROP TYPE IF EXISTS resource_request_status CASCADE;
CREATE TYPE resource_request_status AS ENUM ('new', 'partial', 'ordered', 'received', 'cancelled');

CREATE TABLE IF NOT EXISTS resource_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  estimate_resource_id UUID REFERENCES estimate_resources(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  resource_type resource_type NOT NULL DEFAULT 'material',
  unit_measure_id INTEGER REFERENCES unit_measures(id),
  volume_required NUMERIC(14,4) NOT NULL,
  volume_ordered NUMERIC(14,4) DEFAULT 0,
  volume_received NUMERIC(14,4) DEFAULT 0,
  planned_price NUMERIC(14,4),
  actual_price NUMERIC(14,4),
  planned_cost NUMERIC(14,4) GENERATED ALWAYS AS (volume_required * COALESCE(planned_price, 0)) STORED,
  needed_at DATE,
  status resource_request_status DEFAULT 'new',
  is_over_budget BOOLEAN DEFAULT FALSE,
  comment TEXT,
  created_by_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Orders (заказы поставщикам)
DROP TYPE IF EXISTS order_status CASCADE;
CREATE TYPE order_status AS ENUM ('draft', 'sent', 'confirmed', 'shipped', 'delivered', 'cancelled');

DROP TYPE IF EXISTS order_delivery_status CASCADE;
CREATE TYPE order_delivery_status AS ENUM ('pending', 'partial', 'delivered');

DROP TYPE IF EXISTS order_payment_status CASCADE;
CREATE TYPE order_payment_status AS ENUM ('unpaid', 'partial', 'paid');

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  contractor_id UUID NOT NULL REFERENCES contractors(id) ON DELETE RESTRICT,
  number TEXT NOT NULL,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_date DATE,
  subtotal NUMERIC(14,2) DEFAULT 0,
  nds_percent NUMERIC(5,2) DEFAULT 0,
  nds_amount NUMERIC(14,2) GENERATED ALWAYS AS (subtotal * nds_percent / 100) STORED,
  total NUMERIC(14,2) GENERATED ALWAYS AS (subtotal * (1 + nds_percent / 100)) STORED,
  status order_status DEFAULT 'draft',
  delivery_status order_delivery_status DEFAULT 'pending',
  payment_status order_payment_status DEFAULT 'unpaid',
  notes TEXT,
  internal_notes TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,
  created_by_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- 3. Order Items
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  resource_request_id UUID REFERENCES resource_requests(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  resource_type resource_type NOT NULL DEFAULT 'material',
  unit_measure_id INTEGER REFERENCES unit_measures(id),
  volume NUMERIC(14,4) NOT NULL,
  volume_delivered NUMERIC(14,4) DEFAULT 0,
  unit_price NUMERIC(14,4) NOT NULL DEFAULT 0,
  total_price NUMERIC(14,4) GENERATED ALWAYS AS (volume * unit_price) STORED,
  sort_order INTEGER DEFAULT 0
);

-- 4. Stocks (склады)
CREATE TABLE IF NOT EXISTS stocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Stock Balances (остатки на складе)
CREATE TABLE IF NOT EXISTS stock_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id UUID NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  valuation_id UUID REFERENCES valuations(id) ON DELETE SET NULL,
  unit_measure_id INTEGER REFERENCES unit_measures(id),
  quantity NUMERIC(14,4) NOT NULL DEFAULT 0,
  reserved_quantity NUMERIC(14,4) DEFAULT 0,
  available_quantity NUMERIC(14,4) GENERATED ALWAYS AS (quantity - reserved_quantity) STORED,
  unit_price NUMERIC(14,4) DEFAULT 0,
  total_value NUMERIC(14,4) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Stock Operations
DROP TYPE IF EXISTS stock_operation_type CASCADE;
CREATE TYPE stock_operation_type AS ENUM ('receipt', 'issue', 'transfer', 'inventory');

CREATE TABLE IF NOT EXISTS stock_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  stock_id UUID NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
  operation_type stock_operation_type NOT NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  contractor_id UUID REFERENCES contractors(id) ON DELETE SET NULL,
  estimate_task_id UUID REFERENCES estimate_tasks(id) ON DELETE SET NULL,
  operation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  document_number TEXT,
  comment TEXT,
  created_by_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Stock Operation Items
CREATE TABLE IF NOT EXISTS stock_operation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID NOT NULL REFERENCES stock_operations(id) ON DELETE CASCADE,
  stock_balance_id UUID REFERENCES stock_balances(id) ON DELETE SET NULL,
  order_item_id UUID REFERENCES order_items(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  unit_measure_id INTEGER REFERENCES unit_measures(id),
  quantity NUMERIC(14,4) NOT NULL,
  unit_price NUMERIC(14,4) DEFAULT 0,
  total NUMERIC(14,4) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  sort_order INTEGER DEFAULT 0
);

-- 8. Delivery Receipts (накладные)
CREATE TABLE IF NOT EXISTS delivery_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  stock_id UUID NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
  receipt_number TEXT NOT NULL,
  receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
  contractor_id UUID REFERENCES contractors(id) ON DELETE SET NULL,
  notes TEXT,
  created_by_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Delivery Receipt Items
CREATE TABLE IF NOT EXISTS delivery_receipt_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID NOT NULL REFERENCES delivery_receipts(id) ON DELETE CASCADE,
  order_item_id UUID REFERENCES order_items(id) ON DELETE SET NULL,
  stock_balance_id UUID REFERENCES stock_balances(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  unit_measure_id INTEGER REFERENCES unit_measures(id),
  quantity NUMERIC(14,4) NOT NULL,
  unit_price NUMERIC(14,4) DEFAULT 0,
  total NUMERIC(14,4) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  sort_order INTEGER DEFAULT 0
);

-- 10. Enable RLS
ALTER TABLE resource_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_operation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_receipt_items ENABLE ROW LEVEL SECURITY;

-- 11. RLS Policies
CREATE POLICY "resource_requests_project_access" ON resource_requests
  FOR ALL USING (project_id IN (
    SELECT p.id FROM projects p
    JOIN users u ON u.company_id = p.company_id
    WHERE u.id = auth.uid()
  ));

CREATE POLICY "orders_company_access" ON orders
  FOR ALL USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "order_items_access" ON order_items
  FOR ALL USING (order_id IN (
    SELECT id FROM orders WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  ));

CREATE POLICY "stocks_company_access" ON stocks
  FOR ALL USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "stock_balances_access" ON stock_balances
  FOR ALL USING (stock_id IN (
    SELECT id FROM stocks WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  ));

CREATE POLICY "stock_operations_company_access" ON stock_operations
  FOR ALL USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "stock_operation_items_access" ON stock_operation_items
  FOR ALL USING (operation_id IN (
    SELECT id FROM stock_operations WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  ));

CREATE POLICY "delivery_receipts_company_access" ON delivery_receipts
  FOR ALL USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "delivery_receipt_items_access" ON delivery_receipt_items
  FOR ALL USING (receipt_id IN (
    SELECT id FROM delivery_receipts WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  ));

-- 12. Indexes
CREATE INDEX IF NOT EXISTS idx_resource_requests_project ON resource_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_resource_requests_status ON resource_requests(status);
CREATE INDEX IF NOT EXISTS idx_resource_requests_estimate ON resource_requests(estimate_resource_id);
CREATE INDEX IF NOT EXISTS idx_orders_company ON orders(company_id);
CREATE INDEX IF NOT EXISTS idx_orders_project ON orders(project_id);
CREATE INDEX IF NOT EXISTS idx_orders_contractor ON orders(contractor_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_request ON order_items(resource_request_id);
CREATE INDEX IF NOT EXISTS idx_stocks_company ON stocks(company_id);
CREATE INDEX IF NOT EXISTS idx_stocks_project ON stocks(project_id);
CREATE INDEX IF NOT EXISTS idx_stock_balances_stock ON stock_balances(stock_id);
CREATE INDEX IF NOT EXISTS idx_stock_operations_company ON stock_operations(company_id);
CREATE INDEX IF NOT EXISTS idx_stock_operations_stock ON stock_operations(stock_id);
CREATE INDEX IF NOT EXISTS idx_stock_operations_order ON stock_operations(order_id);
CREATE INDEX IF NOT EXISTS idx_stock_operation_items_operation ON stock_operation_items(operation_id);
CREATE INDEX IF NOT EXISTS idx_delivery_receipts_company ON delivery_receipts(company_id);
CREATE INDEX IF NOT EXISTS idx_delivery_receipts_order ON delivery_receipts(order_id);

-- 13. Triggers
CREATE TRIGGER update_resource_requests_updated_at BEFORE UPDATE ON resource_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stocks_updated_at BEFORE UPDATE ON stocks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stock_balances_updated_at BEFORE UPDATE ON stock_balances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 14. Function to update order subtotal
CREATE OR REPLACE FUNCTION update_order_subtotal()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE orders SET
    subtotal = COALESCE((
      SELECT SUM(total_price) FROM order_items WHERE order_id = COALESCE(NEW.order_id, OLD.order_id)
    ), 0)
  WHERE id = COALESCE(NEW.order_id, OLD.order_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_order_subtotal_trigger
  AFTER INSERT OR UPDATE OR DELETE ON order_items
  FOR EACH ROW EXECUTE FUNCTION update_order_subtotal();

-- 15. Function to update resource request from order items
CREATE OR REPLACE FUNCTION update_resource_request_from_order()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.resource_request_id IS NOT NULL THEN
    UPDATE resource_requests SET
      volume_ordered = COALESCE((
        SELECT SUM(volume) FROM order_items
        WHERE resource_request_id = NEW.resource_request_id
      ), 0),
      actual_price = NEW.unit_price,
      status = CASE
        WHEN volume_required <= (SELECT COALESCE(SUM(volume), 0) FROM order_items WHERE resource_request_id = NEW.resource_request_id) THEN 'ordered'
        WHEN (SELECT COUNT(*) FROM order_items WHERE resource_request_id = NEW.resource_request_id) > 0 THEN 'partial'
        ELSE 'new'
      END,
      is_over_budget = NEW.unit_price > COALESCE(planned_price, 0)
    WHERE id = NEW.resource_request_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_resource_request_from_order_trigger
  AFTER INSERT OR UPDATE ON order_items
  FOR EACH ROW EXECUTE FUNCTION update_resource_request_from_order();

-- 16. Function to update stock balance on receipt
CREATE OR REPLACE FUNCTION update_stock_balance_on_receipt()
RETURNS TRIGGER AS $$
DECLARE
  v_multiplier INTEGER;
BEGIN
  v_multiplier := CASE
    WHEN NEW.operation_type = 'receipt' THEN 1
    WHEN NEW.operation_type = 'issue' THEN -1
    ELSE 0
  END;

  -- This is handled by stock_operation_items trigger
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 17. Function to update stock balance from operation items
CREATE OR REPLACE FUNCTION update_stock_balance_from_operation_item()
RETURNS TRIGGER AS $$
DECLARE
  v_operation RECORD;
  v_quantity_delta NUMERIC(14,4);
BEGIN
  SELECT * INTO v_operation FROM stock_operations WHERE id = NEW.operation_id;

  IF v_operation.operation_type = 'receipt' THEN
    v_quantity_delta := NEW.quantity;
  ELSIF v_operation.operation_type = 'issue' THEN
    v_quantity_delta := -NEW.quantity;
  ELSE
    RETURN NEW;
  END IF;

  IF NEW.stock_balance_id IS NOT NULL THEN
    UPDATE stock_balances SET
      quantity = quantity + v_quantity_delta,
      unit_price = CASE
        WHEN v_operation.operation_type = 'receipt' THEN
          (quantity * unit_price + NEW.quantity * NEW.unit_price) / NULLIF(quantity + NEW.quantity, 0)
        ELSE unit_price
      END
    WHERE id = NEW.stock_balance_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_stock_balance_from_operation_item_trigger
  AFTER INSERT ON stock_operation_items
  FOR EACH ROW EXECUTE FUNCTION update_stock_balance_from_operation_item();

-- 18. Link finance_operations to orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'finance_operations_order_id_fkey'
  ) THEN
    ALTER TABLE finance_operations
      ADD CONSTRAINT finance_operations_order_id_fkey
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;
  END IF;
END $$;
