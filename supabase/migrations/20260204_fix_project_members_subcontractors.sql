-- Allow subcontractor workers in project_members by adding worker_id
-- and making user_id nullable for subcontractor members

-- Make user_id nullable
ALTER TABLE project_members ALTER COLUMN user_id DROP NOT NULL;

-- Add worker_id column for subcontractor workers
ALTER TABLE project_members ADD COLUMN IF NOT EXISTS worker_id UUID;

-- Drop the old unique constraint and create a new one
-- that handles both employee (user_id) and subcontractor (worker_id) members
ALTER TABLE project_members DROP CONSTRAINT IF EXISTS project_members_project_id_user_id_key;

-- Create unique indexes for both cases
CREATE UNIQUE INDEX IF NOT EXISTS idx_pm_project_user
  ON project_members(project_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pm_project_worker
  ON project_members(project_id, worker_id)
  WHERE worker_id IS NOT NULL;
