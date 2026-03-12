-- =====================================================
-- Migration: Project Acceptance Acts
-- Date: 2026-03-12
-- Description: Acts of acceptance for project work
-- =====================================================

CREATE TABLE IF NOT EXISTS project_acceptance_acts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  act_number TEXT NOT NULL,
  act_date DATE NOT NULL DEFAULT CURRENT_DATE,
  period_from DATE,
  period_to DATE,
  total_amount NUMERIC(14,2) DEFAULT 0,
  vat_rate NUMERIC(5,2) DEFAULT 23,
  vat_amount NUMERIC(14,2) GENERATED ALWAYS AS (total_amount * vat_rate / 100) STORED,
  total_gross NUMERIC(14,2) GENERATED ALWAYS AS (total_amount + total_amount * vat_rate / 100) STORED,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'signed', 'rejected')),
  description TEXT,
  scope_of_work TEXT,
  notes TEXT,
  pdf_url TEXT,
  created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE project_acceptance_acts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_acceptance_acts_company_access"
  ON project_acceptance_acts FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_project_acceptance_acts_project ON project_acceptance_acts(project_id);
CREATE INDEX IF NOT EXISTS idx_project_acceptance_acts_company ON project_acceptance_acts(company_id);

CREATE OR REPLACE FUNCTION update_project_acceptance_acts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER project_acceptance_acts_updated_at
  BEFORE UPDATE ON project_acceptance_acts
  FOR EACH ROW EXECUTE FUNCTION update_project_acceptance_acts_updated_at();
