-- Add category and created_by to project_tasks
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS created_by UUID;

-- Add task_id to project_costs (optional link to a specific task)
ALTER TABLE project_costs ADD COLUMN IF NOT EXISTS task_id UUID;

-- Create task_categories table for custom categories per company
CREATE TABLE IF NOT EXISTS project_task_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, name)
);

-- Enable RLS
ALTER TABLE project_task_categories ENABLE ROW LEVEL SECURITY;

-- RLS policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'project_task_categories_select' AND tablename = 'project_task_categories') THEN
    CREATE POLICY project_task_categories_select ON project_task_categories FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'project_task_categories_insert' AND tablename = 'project_task_categories') THEN
    CREATE POLICY project_task_categories_insert ON project_task_categories FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'project_task_categories_update' AND tablename = 'project_task_categories') THEN
    CREATE POLICY project_task_categories_update ON project_task_categories FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'project_task_categories_delete' AND tablename = 'project_task_categories') THEN
    CREATE POLICY project_task_categories_delete ON project_task_categories FOR DELETE USING (true);
  END IF;
END $$;

-- Fix task_attachments: drop old FK if it references tasks table (not project_tasks)
ALTER TABLE task_attachments DROP CONSTRAINT IF EXISTS task_attachments_task_id_fkey;

-- Seed default task categories (these will be added per-company on first use)
