-- =============================================
-- Add module_user_counts column to crm_deals
-- Stores per-module user counts as JSONB
-- Example: {"recruitment": 10, "skills": 5}
-- =============================================

ALTER TABLE crm_deals
ADD COLUMN IF NOT EXISTS module_user_counts JSONB;

-- Add a comment for documentation
COMMENT ON COLUMN crm_deals.module_user_counts IS 'Per-module user counts as JSON object, e.g., {"recruitment": 10, "skills": 5}';
