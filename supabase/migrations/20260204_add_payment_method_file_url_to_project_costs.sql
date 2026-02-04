-- Add payment_method and file_url columns to project_costs
ALTER TABLE project_costs ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE project_costs ADD COLUMN IF NOT EXISTS file_url TEXT;
