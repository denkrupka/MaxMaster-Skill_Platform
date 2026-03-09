-- Add author_name column to plan_comments if missing
ALTER TABLE plan_comments ADD COLUMN IF NOT EXISTS author_name TEXT;

-- Add author_name to plans for version tracking
ALTER TABLE plans ADD COLUMN IF NOT EXISTS saved_by_name TEXT;
