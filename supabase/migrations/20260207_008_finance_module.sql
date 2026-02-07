-- =====================================================
-- Migration: Finance Module (Finanse)
-- Date: 2026-02-07
-- Description: Financial operations, accounts, and acts
-- =====================================================

-- 1. Finance Accounts
CREATE TABLE IF NOT EXISTS finance_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL DEFAULT 'bank' CHECK (account_type IN ('bank', 'cash', 'card')),
  bank_name TEXT,
  bank_bik TEXT,
  account_number TEXT,
  corr_account TEXT,
  currency_id INTEGER REFERENCES currencies(id) DEFAULT 1,
  initial_balance NUMERIC(14,2) DEFAULT 0,
  current_balance NUMERIC(14,2) DEFAULT 0,
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Finance Operation Articles (статьи доходов/расходов)
DROP TYPE IF EXISTS finance_operation_type CASCADE;
CREATE TYPE finance_operation_type AS ENUM ('income', 'expense');

CREATE TABLE IF NOT EXISTS finance_operation_articles (
  id SERIAL PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  parent_id INTEGER REFERENCES finance_operation_articles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  operation_type finance_operation_type NOT NULL,
  is_system BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0
);

-- Insert default articles
INSERT INTO finance_operation_articles (name, code, operation_type, is_system, sort_order) VALUES
  -- Income
  ('Przychody z projektów', 'INC-01', 'income', TRUE, 1),
  ('Zaliczki od klientów', 'INC-02', 'income', TRUE, 2),
  ('Inne przychody', 'INC-99', 'income', TRUE, 99),
  -- Expenses
  ('Materiały', 'EXP-01', 'expense', TRUE, 1),
  ('Robocizna', 'EXP-02', 'expense', TRUE, 2),
  ('Sprzęt', 'EXP-03', 'expense', TRUE, 3),
  ('Podwykonawcy', 'EXP-04', 'expense', TRUE, 4),
  ('Transport', 'EXP-05', 'expense', TRUE, 5),
  ('Administracja', 'EXP-06', 'expense', TRUE, 6),
  ('Inne koszty', 'EXP-99', 'expense', TRUE, 99)
ON CONFLICT DO NOTHING;

-- 3. Finance Operations
DROP TYPE IF EXISTS finance_operation_status CASCADE;
CREATE TYPE finance_operation_status AS ENUM ('pending', 'completed', 'cancelled');

CREATE TABLE IF NOT EXISTS finance_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  account_id UUID NOT NULL REFERENCES finance_accounts(id) ON DELETE RESTRICT,
  operation_type finance_operation_type NOT NULL,
  operation_article_id INTEGER REFERENCES finance_operation_articles(id),
  amount NUMERIC(14,2) NOT NULL,
  currency_id INTEGER REFERENCES currencies(id) DEFAULT 1,
  operation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  accrual_date DATE,
  contractor_id UUID REFERENCES contractors(id) ON DELETE SET NULL,
  act_id UUID,
  order_id UUID,
  invoice_number TEXT,
  description TEXT,
  comment TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,
  status finance_operation_status DEFAULT 'completed',
  confirmed_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  confirmed_at TIMESTAMPTZ,
  created_by_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- 4. Finance Acts (акты выполненных работ)
DROP TYPE IF EXISTS act_status CASCADE;
CREATE TYPE act_status AS ENUM ('draft', 'sent', 'accepted', 'rejected');

DROP TYPE IF EXISTS act_payment_status CASCADE;
CREATE TYPE act_payment_status AS ENUM ('unpaid', 'partial', 'paid');

DROP TYPE IF EXISTS act_type CASCADE;
CREATE TYPE act_type AS ENUM ('customer', 'contractor');

DROP TYPE IF EXISTS act_form_type CASCADE;
CREATE TYPE act_form_type AS ENUM ('KS2', 'KS6a', 'free');

CREATE TABLE IF NOT EXISTS finance_acts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  number TEXT NOT NULL,
  act_date DATE NOT NULL DEFAULT CURRENT_DATE,
  period_from DATE NOT NULL,
  period_to DATE NOT NULL,
  contractor_id UUID NOT NULL REFERENCES contractors(id) ON DELETE RESTRICT,
  responsible_id UUID REFERENCES users(id) ON DELETE SET NULL,
  subtotal NUMERIC(14,2) DEFAULT 0,
  markups_json JSONB DEFAULT '[]'::jsonb, -- [{name, type, value, amount}]
  total NUMERIC(14,2) DEFAULT 0,
  act_type act_type NOT NULL DEFAULT 'customer',
  form_type act_form_type DEFAULT 'free',
  status act_status DEFAULT 'draft',
  payment_status act_payment_status DEFAULT 'unpaid',
  paid_amount NUMERIC(14,2) DEFAULT 0,
  notes TEXT,
  internal_notes TEXT,
  template_id UUID,
  generated_pdf_url TEXT,
  created_by_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- 5. Finance Act Items
CREATE TABLE IF NOT EXISTS finance_act_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  act_id UUID NOT NULL REFERENCES finance_acts(id) ON DELETE CASCADE,
  estimate_task_id UUID REFERENCES estimate_tasks(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  unit_measure_id INTEGER REFERENCES unit_measures(id),
  volume_total NUMERIC(14,4) DEFAULT 0,
  volume_previous NUMERIC(14,4) DEFAULT 0,
  volume_current NUMERIC(14,4) DEFAULT 0,
  unit_price NUMERIC(14,4) DEFAULT 0,
  amount_total NUMERIC(14,4) GENERATED ALWAYS AS (volume_total * unit_price) STORED,
  amount_previous NUMERIC(14,4) GENERATED ALWAYS AS (volume_previous * unit_price) STORED,
  amount_current NUMERIC(14,4) GENERATED ALWAYS AS (volume_current * unit_price) STORED,
  sort_order INTEGER DEFAULT 0
);

-- 6. Finance Act History
CREATE TABLE IF NOT EXISTS finance_act_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  act_id UUID NOT NULL REFERENCES finance_acts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Budget Plans (плановый бюджет проекта)
CREATE TABLE IF NOT EXISTS project_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  planned_income NUMERIC(14,2) DEFAULT 0,
  planned_expense NUMERIC(14,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, year, month)
);

-- 8. Enable RLS
ALTER TABLE finance_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_operation_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_acts ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_act_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_act_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_budgets ENABLE ROW LEVEL SECURITY;

-- 9. RLS Policies
CREATE POLICY "finance_accounts_company_access" ON finance_accounts
  FOR ALL USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "finance_operation_articles_access" ON finance_operation_articles
  FOR ALL USING (
    is_system = TRUE OR
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "finance_operations_company_access" ON finance_operations
  FOR ALL USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "finance_acts_company_access" ON finance_acts
  FOR ALL USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "finance_act_items_access" ON finance_act_items
  FOR ALL USING (act_id IN (
    SELECT id FROM finance_acts WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  ));

CREATE POLICY "finance_act_history_access" ON finance_act_history
  FOR ALL USING (act_id IN (
    SELECT id FROM finance_acts WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  ));

CREATE POLICY "project_budgets_access" ON project_budgets
  FOR ALL USING (project_id IN (
    SELECT p.id FROM projects p
    JOIN users u ON u.company_id = p.company_id
    WHERE u.id = auth.uid()
  ));

-- 10. Indexes
CREATE INDEX IF NOT EXISTS idx_finance_accounts_company ON finance_accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_finance_operation_articles_company ON finance_operation_articles(company_id);
CREATE INDEX IF NOT EXISTS idx_finance_operation_articles_parent ON finance_operation_articles(parent_id);
CREATE INDEX IF NOT EXISTS idx_finance_operations_company ON finance_operations(company_id);
CREATE INDEX IF NOT EXISTS idx_finance_operations_project ON finance_operations(project_id);
CREATE INDEX IF NOT EXISTS idx_finance_operations_account ON finance_operations(account_id);
CREATE INDEX IF NOT EXISTS idx_finance_operations_date ON finance_operations(operation_date);
CREATE INDEX IF NOT EXISTS idx_finance_operations_contractor ON finance_operations(contractor_id);
CREATE INDEX IF NOT EXISTS idx_finance_acts_company ON finance_acts(company_id);
CREATE INDEX IF NOT EXISTS idx_finance_acts_project ON finance_acts(project_id);
CREATE INDEX IF NOT EXISTS idx_finance_acts_contractor ON finance_acts(contractor_id);
CREATE INDEX IF NOT EXISTS idx_finance_acts_status ON finance_acts(status);
CREATE INDEX IF NOT EXISTS idx_finance_act_items_act ON finance_act_items(act_id);
CREATE INDEX IF NOT EXISTS idx_project_budgets_project ON project_budgets(project_id);

-- 11. Triggers
CREATE TRIGGER update_finance_accounts_updated_at BEFORE UPDATE ON finance_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_finance_operations_updated_at BEFORE UPDATE ON finance_operations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_finance_acts_updated_at BEFORE UPDATE ON finance_acts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_budgets_updated_at BEFORE UPDATE ON project_budgets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 12. Function to update account balance
CREATE OR REPLACE FUNCTION update_account_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_delta NUMERIC(14,2);
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'completed' THEN
    v_delta := CASE WHEN NEW.operation_type = 'income' THEN NEW.amount ELSE -NEW.amount END;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'completed' AND NEW.status != 'completed' THEN
      v_delta := CASE WHEN OLD.operation_type = 'income' THEN -OLD.amount ELSE OLD.amount END;
    ELSIF OLD.status != 'completed' AND NEW.status = 'completed' THEN
      v_delta := CASE WHEN NEW.operation_type = 'income' THEN NEW.amount ELSE -NEW.amount END;
    ELSIF OLD.status = 'completed' AND NEW.status = 'completed' THEN
      v_delta := (CASE WHEN NEW.operation_type = 'income' THEN NEW.amount ELSE -NEW.amount END) -
                 (CASE WHEN OLD.operation_type = 'income' THEN OLD.amount ELSE -OLD.amount END);
    ELSE
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'DELETE' AND OLD.status = 'completed' THEN
    v_delta := CASE WHEN OLD.operation_type = 'income' THEN -OLD.amount ELSE OLD.amount END;
    UPDATE finance_accounts SET current_balance = current_balance + v_delta WHERE id = OLD.account_id;
    RETURN OLD;
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  UPDATE finance_accounts SET current_balance = current_balance + v_delta WHERE id = COALESCE(NEW.account_id, OLD.account_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_account_balance_trigger
  AFTER INSERT OR UPDATE OR DELETE ON finance_operations
  FOR EACH ROW EXECUTE FUNCTION update_account_balance();

-- 13. Function to update act totals
CREATE OR REPLACE FUNCTION update_act_totals()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE finance_acts SET
    subtotal = COALESCE((
      SELECT SUM(amount_current) FROM finance_act_items WHERE act_id = COALESCE(NEW.act_id, OLD.act_id)
    ), 0)
  WHERE id = COALESCE(NEW.act_id, OLD.act_id);

  -- Recalculate total with markups
  UPDATE finance_acts SET
    total = subtotal * (1 + COALESCE((
      SELECT SUM(
        CASE
          WHEN m->>'type' = 'percent' THEN (m->>'value')::NUMERIC / 100
          ELSE 0
        END
      ) FROM jsonb_array_elements(markups_json) m
    ), 0)) + COALESCE((
      SELECT SUM((m->>'amount')::NUMERIC)
      FROM jsonb_array_elements(markups_json) m
      WHERE m->>'type' = 'fixed'
    ), 0)
  WHERE id = COALESCE(NEW.act_id, OLD.act_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_act_totals_trigger
  AFTER INSERT OR UPDATE OR DELETE ON finance_act_items
  FOR EACH ROW EXECUTE FUNCTION update_act_totals();

-- 14. Link finance_operations to finance_acts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'finance_operations_act_id_fkey'
  ) THEN
    ALTER TABLE finance_operations
      ADD CONSTRAINT finance_operations_act_id_fkey
      FOREIGN KEY (act_id) REFERENCES finance_acts(id) ON DELETE SET NULL;
  END IF;
END $$;
