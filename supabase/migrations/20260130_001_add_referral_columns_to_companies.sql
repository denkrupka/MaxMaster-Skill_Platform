-- Add referral program columns to companies table
-- These track which company referred this one and whether the bonus was paid

ALTER TABLE companies ADD COLUMN IF NOT EXISTS referred_by_company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS referral_bonus_paid BOOLEAN DEFAULT FALSE;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS referral_bonus_paid_at TIMESTAMPTZ;

-- Index for quick lookup of companies referred by a specific company
CREATE INDEX IF NOT EXISTS idx_companies_referred_by ON companies(referred_by_company_id);

COMMENT ON COLUMN companies.referred_by_company_id IS 'ID of the company that referred this company via the referral program';
COMMENT ON COLUMN companies.referral_bonus_paid IS 'Whether the referral bonus has been credited to the referring company';
COMMENT ON COLUMN companies.referral_bonus_paid_at IS 'When the referral bonus was credited';
