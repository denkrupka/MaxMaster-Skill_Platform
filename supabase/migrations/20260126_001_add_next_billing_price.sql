-- =====================================================
-- Add next_billing_cycle_price to company_modules
-- This allows scheduling price changes to take effect on next billing cycle
-- =====================================================

-- Add column for scheduled price (effective from next billing cycle)
ALTER TABLE company_modules
ADD COLUMN IF NOT EXISTS next_billing_cycle_price DECIMAL(10,2) DEFAULT NULL;

-- Add column to track when the price was scheduled
ALTER TABLE company_modules
ADD COLUMN IF NOT EXISTS price_scheduled_at TIMESTAMPTZ DEFAULT NULL;

-- Add comment to explain the column
COMMENT ON COLUMN company_modules.next_billing_cycle_price IS 'Price per user that will be applied starting from next billing cycle. NULL means no change scheduled.';
COMMENT ON COLUMN company_modules.price_scheduled_at IS 'Timestamp when the price change was scheduled by admin.';
