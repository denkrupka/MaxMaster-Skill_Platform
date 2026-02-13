-- Add data_json column to kosztorys_estimates for storing full estimate data
-- This allows storing the complete estimate structure (sections, positions, resources)

ALTER TABLE kosztorys_estimates
ADD COLUMN IF NOT EXISTS data_json JSONB;

-- Add index for faster querying
CREATE INDEX IF NOT EXISTS idx_kosztorys_estimates_data_json
ON kosztorys_estimates USING gin (data_json);

COMMENT ON COLUMN kosztorys_estimates.data_json IS 'Full estimate data in JSON format (sections, positions, resources with all details)';
