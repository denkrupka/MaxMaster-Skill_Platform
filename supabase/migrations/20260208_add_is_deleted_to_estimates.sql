-- Add is_deleted column to kosztorys_estimates for soft delete functionality
ALTER TABLE kosztorys_estimates ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;

-- Create index for filtering deleted estimates
CREATE INDEX IF NOT EXISTS idx_kosztorys_estimates_is_deleted ON kosztorys_estimates(is_deleted);

COMMENT ON COLUMN kosztorys_estimates.is_deleted IS 'Soft delete flag for estimates';
