-- =====================================================
-- Add demo_end_date to company_modules for per-module DEMO periods
-- =====================================================

-- Add demo_end_date column to company_modules
ALTER TABLE company_modules
ADD COLUMN IF NOT EXISTS demo_end_date TIMESTAMPTZ DEFAULT NULL;

-- Add comment
COMMENT ON COLUMN company_modules.demo_end_date IS 'Per-module demo end date (null = no demo, date = demo active until that date)';

-- Create index for active demos
CREATE INDEX IF NOT EXISTS idx_company_modules_demo ON company_modules(demo_end_date) WHERE demo_end_date IS NOT NULL;

-- Add action type for demo ended
-- (DEMO_ENDED will be used when demo is manually ended)
