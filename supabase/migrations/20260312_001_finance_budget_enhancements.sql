-- =====================================================
-- Migration: Finance Budget Enhancements
-- Date: 2026-03-12
-- Description: Budget categories, monthly budget plans, JPK export log
-- =====================================================

-- 1. Budget categories per project
CREATE TABLE IF NOT EXISTS project_budget_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category_code TEXT NOT NULL DEFAULT 'other',
  planned_amount NUMERIC(14,2) DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE project_budget_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_budget_categories_access" ON project_budget_categories
  FOR ALL USING (project_id IN (
    SELECT p.id FROM projects p
    JOIN users u ON u.company_id = p.company_id
    WHERE u.id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS idx_project_budget_categories_project ON project_budget_categories(project_id);

-- 2. Add fields to resource_requests if missing
ALTER TABLE resource_requests ADD COLUMN IF NOT EXISTS description TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'resource_requests' AND column_name = 'priority'
  ) THEN
    ALTER TABLE resource_requests ADD COLUMN priority TEXT DEFAULT 'medium';
  END IF;
END $$;
