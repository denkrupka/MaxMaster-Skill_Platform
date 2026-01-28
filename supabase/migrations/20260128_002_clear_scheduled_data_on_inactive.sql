-- Clear scheduled_max_users and period data for inactive modules
-- This fixes data from subscriptions that were canceled before this fix was deployed

UPDATE company_modules
SET
  scheduled_max_users = NULL,
  scheduled_change_at = NULL,
  subscription_period_start = NULL,
  subscription_period_end = NULL,
  next_billing_cycle_price = NULL,
  price_scheduled_at = NULL
WHERE is_active = false
  AND (
    scheduled_max_users IS NOT NULL
    OR scheduled_change_at IS NOT NULL
    OR subscription_period_start IS NOT NULL
    OR subscription_period_end IS NOT NULL
    OR next_billing_cycle_price IS NOT NULL
    OR price_scheduled_at IS NOT NULL
  );

-- Clear scheduled data for active modules that were reactivated after the scheduled change was made
-- This handles cases where a subscription was canceled and then a new one was created
-- but the old scheduled_max_users value remained
UPDATE company_modules
SET
  scheduled_max_users = NULL,
  scheduled_change_at = NULL,
  next_billing_cycle_price = NULL,
  price_scheduled_at = NULL
WHERE is_active = true
  AND scheduled_change_at IS NOT NULL
  AND activated_at IS NOT NULL
  AND activated_at > scheduled_change_at;
