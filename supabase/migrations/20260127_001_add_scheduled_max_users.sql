-- =====================================================
-- Add scheduled_max_users and subscription_period_end to company_modules
-- This allows scheduling seat count changes to take effect on next billing cycle
-- and tracking subscription period for prorated calculations
-- =====================================================

-- Add column for scheduled max users (effective from next billing cycle)
ALTER TABLE company_modules
ADD COLUMN IF NOT EXISTS scheduled_max_users INTEGER DEFAULT NULL;

-- Add column to track when the change was scheduled
ALTER TABLE company_modules
ADD COLUMN IF NOT EXISTS scheduled_change_at TIMESTAMPTZ DEFAULT NULL;

-- Add column for subscription period end date (from Stripe)
ALTER TABLE company_modules
ADD COLUMN IF NOT EXISTS subscription_period_end TIMESTAMPTZ DEFAULT NULL;

-- Add column for subscription period start date (from Stripe)
ALTER TABLE company_modules
ADD COLUMN IF NOT EXISTS subscription_period_start TIMESTAMPTZ DEFAULT NULL;

-- Add comments to explain the columns
COMMENT ON COLUMN company_modules.scheduled_max_users IS 'Number of max_users that will be applied starting from next billing cycle. NULL means no change scheduled.';
COMMENT ON COLUMN company_modules.scheduled_change_at IS 'Timestamp when the seat count change was scheduled.';
COMMENT ON COLUMN company_modules.subscription_period_end IS 'End date of current subscription billing period from Stripe.';
COMMENT ON COLUMN company_modules.subscription_period_start IS 'Start date of current subscription billing period from Stripe.';
