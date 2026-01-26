-- Add industry column to companies table
ALTER TABLE companies ADD COLUMN IF NOT EXISTS industry VARCHAR(100);

-- Add comment
COMMENT ON COLUMN companies.industry IS 'Industry/sector the company operates in';
