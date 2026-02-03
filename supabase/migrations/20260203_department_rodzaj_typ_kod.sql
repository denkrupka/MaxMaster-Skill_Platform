-- Migration: Add Rodzaj, Typ, Kod obiektu to departments
-- Date: 2026-02-03

-- Lookup table for Rodzaj (Kind) options per company
CREATE TABLE IF NOT EXISTS department_rodzaj_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, name)
);

-- Lookup table for Typ (Type) options per company
CREATE TABLE IF NOT EXISTS department_typ_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, name)
);

-- Add new columns to departments
ALTER TABLE departments ADD COLUMN IF NOT EXISTS rodzaj TEXT;
ALTER TABLE departments ADD COLUMN IF NOT EXISTS typ TEXT;
ALTER TABLE departments ADD COLUMN IF NOT EXISTS kod_obiektu TEXT;

-- RLS policies for department_rodzaj_options
ALTER TABLE department_rodzaj_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view rodzaj options for their company"
  ON department_rodzaj_options FOR SELECT
  USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Admins can insert rodzaj options"
  ON department_rodzaj_options FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid() AND role IN ('company_admin', 'hr', 'coordinator')
  ));

CREATE POLICY "Admins can delete rodzaj options"
  ON department_rodzaj_options FOR DELETE
  USING (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid() AND role IN ('company_admin', 'hr')
  ));

-- RLS policies for department_typ_options
ALTER TABLE department_typ_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view typ options for their company"
  ON department_typ_options FOR SELECT
  USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Admins can insert typ options"
  ON department_typ_options FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid() AND role IN ('company_admin', 'hr', 'coordinator')
  ));

CREATE POLICY "Admins can delete typ options"
  ON department_typ_options FOR DELETE
  USING (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid() AND role IN ('company_admin', 'hr')
  ));
