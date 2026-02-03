-- =====================================================
-- Migration: Project Employees, Issues enhancements, Attachments
-- Date: 2026-02-03
-- Description: Add position to project_members, issue categories table
-- =====================================================

-- 1. Add position field to project_members
ALTER TABLE project_members
  ADD COLUMN IF NOT EXISTS position TEXT;

-- 2. Create project_issue_categories table for dynamic categories
CREATE TABLE IF NOT EXISTS project_issue_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, name)
);

ALTER TABLE project_issue_categories ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Company members can access project_issue_categories" ON project_issue_categories
    FOR ALL USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Add file_urls to project_issues for attachments on issues
ALTER TABLE project_issues
  ADD COLUMN IF NOT EXISTS file_urls TEXT[];
