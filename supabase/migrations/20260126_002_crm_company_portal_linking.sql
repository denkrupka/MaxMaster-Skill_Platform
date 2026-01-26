-- Add portal account linking fields to crm_companies
-- This allows linking CRM companies to portal companies (for subscription/account tracking)

-- Add linked_company_id to reference the companies table
ALTER TABLE crm_companies
ADD COLUMN IF NOT EXISTS linked_company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

-- Add subscription status and end date for display purposes (synced from linked company)
ALTER TABLE crm_companies
ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'brak';

ALTER TABLE crm_companies
ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMPTZ;

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_crm_companies_linked_company ON crm_companies(linked_company_id);

-- Add comment for documentation
COMMENT ON COLUMN crm_companies.linked_company_id IS 'Reference to companies table when CRM company has portal account';
COMMENT ON COLUMN crm_companies.subscription_status IS 'Subscription status: brak, trialing, active, past_due, cancelled';
COMMENT ON COLUMN crm_companies.subscription_end_date IS 'When the subscription ends or ended';
