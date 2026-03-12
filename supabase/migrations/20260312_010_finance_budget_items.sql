-- =====================================================
-- Migration: Finance Budget Items + Receipts
-- Date: 2026-03-12
-- =====================================================

-- 1. budget_items: detailed budget breakdown per project
CREATE TABLE IF NOT EXISTS budget_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'inne',
  name TEXT NOT NULL,
  planned_amount NUMERIC(14,2) DEFAULT 0,
  actual_amount NUMERIC(14,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE budget_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "budget_items_company_access" ON budget_items
  FOR ALL USING (company_id IN (
    SELECT u.company_id FROM users u WHERE u.id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS idx_budget_items_project ON budget_items(project_id);
CREATE INDEX IF NOT EXISTS idx_budget_items_company ON budget_items(company_id);

-- 2. finance_receipts: attach receipts/photos to operations
CREATE TABLE IF NOT EXISTS finance_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  operation_id UUID REFERENCES finance_operations(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  uploaded_by_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE finance_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finance_receipts_company_access" ON finance_receipts
  FOR ALL USING (company_id IN (
    SELECT u.company_id FROM users u WHERE u.id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS idx_finance_receipts_operation ON finance_receipts(operation_id);

-- 3. Trigger for budget_items updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_budget_items_updated_at ON budget_items;
CREATE TRIGGER update_budget_items_updated_at
  BEFORE UPDATE ON budget_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
