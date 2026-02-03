-- =====================================================
-- Migration: Extended Projects Module
-- Date: 2026-02-03
-- Description: Adds new fields and tables for extended project management
-- =====================================================

-- 1. Extend projects table with new fields
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS name_mode TEXT NOT NULL DEFAULT 'custom',
  ADD COLUMN IF NOT EXISTS billing_type TEXT NOT NULL DEFAULT 'ryczalt',
  ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS overtime_paid BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS overtime_rate NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS overtime_base_hours NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS saturday_paid BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS saturday_rate NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS saturday_hours NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS sunday_paid BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS sunday_rate NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS sunday_hours NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS night_paid BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS night_rate NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS night_hours NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS travel_paid BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS travel_rate NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS travel_hours NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS contractor_client_id UUID REFERENCES contractors_clients(id) ON DELETE SET NULL;

-- 2. Extend project_members table
ALTER TABLE project_members
  ADD COLUMN IF NOT EXISTS member_type TEXT NOT NULL DEFAULT 'employee',
  ADD COLUMN IF NOT EXISTS payment_type TEXT NOT NULL DEFAULT 'hourly',
  ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS member_status TEXT NOT NULL DEFAULT 'assigned';

-- 3. Extend project_tasks table
ALTER TABLE project_tasks
  ADD COLUMN IF NOT EXISTS billing_type TEXT NOT NULL DEFAULT 'ryczalt',
  ADD COLUMN IF NOT EXISTS hourly_value NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS quantity NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS unit TEXT,
  ADD COLUMN IF NOT EXISTS price_per_unit NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS total_value NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS worker_payment_type TEXT NOT NULL DEFAULT 'hourly',
  ADD COLUMN IF NOT EXISTS worker_rate_per_unit NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS assigned_users TEXT[],
  ADD COLUMN IF NOT EXISTS has_start_deadline BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS start_time TIME,
  ADD COLUMN IF NOT EXISTS has_end_deadline BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS end_time TIME;

-- 4. Create project_protocols table
CREATE TABLE IF NOT EXISTS project_protocols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  protocol_number TEXT NOT NULL,
  protocol_type TEXT NOT NULL DEFAULT 'standard',
  advancement_percent NUMERIC(5,2) DEFAULT 0,
  period_from DATE,
  period_to DATE,
  total_value NUMERIC(14,2) DEFAULT 0,
  invoice_number TEXT,
  client_representative_id UUID,
  tasks_data JSONB DEFAULT '[]'::jsonb,
  accepted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Create project_income table
CREATE TABLE IF NOT EXISTS project_income (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  document_type TEXT NOT NULL,
  document_number TEXT NOT NULL,
  issue_date DATE NOT NULL,
  payment_due_date DATE NOT NULL,
  value NUMERIC(14,2) NOT NULL DEFAULT 0,
  basis_id UUID,
  basis_type TEXT,
  payment_status TEXT DEFAULT 'unpaid',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Create project_costs table
CREATE TABLE IF NOT EXISTS project_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  cost_type TEXT NOT NULL DEFAULT 'direct',
  document_type TEXT,
  document_number TEXT,
  issue_date DATE,
  payment_due_date DATE,
  issuer TEXT,
  value_netto NUMERIC(14,2) NOT NULL DEFAULT 0,
  category TEXT,
  payment_status TEXT DEFAULT 'unpaid',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Create project_schedule table
CREATE TABLE IF NOT EXISTS project_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  planned_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, year, month)
);

-- 8. Create project_issues table (Zgłoszenia)
CREATE TABLE IF NOT EXISTS project_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  name TEXT NOT NULL,
  reporter_id UUID NOT NULL,
  reporter_company TEXT,
  task_id UUID REFERENCES project_tasks(id) ON DELETE SET NULL,
  category TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  description TEXT,
  accepted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 9. Create project_issue_history table
CREATE TABLE IF NOT EXISTS project_issue_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES project_issues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  description TEXT,
  file_urls TEXT[],
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. Create project_files table (Załączniki projektu)
CREATE TABLE IF NOT EXISTS project_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 11. Add contact_persons to project_customers
ALTER TABLE project_customers
  ADD COLUMN IF NOT EXISTS contact_persons JSONB DEFAULT '[]'::jsonb;

-- 12. Enable RLS on new tables
ALTER TABLE project_protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_income ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_issue_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;

-- 13. RLS policies (company-scoped access)
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['project_protocols', 'project_income', 'project_costs', 'project_schedule', 'project_issues', 'project_files']
  LOOP
    EXECUTE format('
      CREATE POLICY IF NOT EXISTS "Company members can access %1$s" ON %1$s
        FOR ALL USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));
    ', tbl);
  END LOOP;
END $$;

CREATE POLICY IF NOT EXISTS "Company members can access project_issue_history" ON project_issue_history
  FOR ALL USING (issue_id IN (SELECT id FROM project_issues WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())));

-- 14. Indexes
CREATE INDEX IF NOT EXISTS idx_project_protocols_project ON project_protocols(project_id);
CREATE INDEX IF NOT EXISTS idx_project_income_project ON project_income(project_id);
CREATE INDEX IF NOT EXISTS idx_project_costs_project ON project_costs(project_id);
CREATE INDEX IF NOT EXISTS idx_project_schedule_project ON project_schedule(project_id);
CREATE INDEX IF NOT EXISTS idx_project_issues_project ON project_issues(project_id);
CREATE INDEX IF NOT EXISTS idx_project_files_project ON project_files(project_id);
CREATE INDEX IF NOT EXISTS idx_project_issue_history_issue ON project_issue_history(issue_id);
CREATE INDEX IF NOT EXISTS idx_projects_department ON projects(department_id);
