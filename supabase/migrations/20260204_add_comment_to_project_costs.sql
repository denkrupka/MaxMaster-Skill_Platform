-- Add comment field to project_costs
ALTER TABLE project_costs ADD COLUMN IF NOT EXISTS comment TEXT;
