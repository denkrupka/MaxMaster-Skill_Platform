-- =========================================================
-- Migration: Referral system + Onboarding
-- =========================================================

-- 1. Add bonus_months to companies
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS bonus_months integer NOT NULL DEFAULT 0;

-- 2. Add onboarding_completed to companies
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

-- 3. Create referrals table
CREATE TABLE IF NOT EXISTS referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  referred_company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'paid')),
  bonus_months integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  paid_at timestamptz,
  UNIQUE (referrer_company_id, referred_company_id)
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_company_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_company_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);

-- 5. RLS on referrals
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- Company admin can see their referrals (as referrer)
CREATE POLICY "Company sees own referrals" ON referrals
  FOR SELECT
  USING (
    referrer_company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

-- Service role can do anything (edge functions)
CREATE POLICY "Service role full access on referrals" ON referrals
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 6. Back-fill referrals from existing referred_by_company_id
INSERT INTO referrals (referrer_company_id, referred_company_id, status, bonus_months, created_at)
SELECT
  referred_by_company_id,
  id,
  CASE
    WHEN subscription_status = 'active' THEN 'active'
    ELSE 'pending'
  END,
  1,
  created_at
FROM companies
WHERE referred_by_company_id IS NOT NULL
ON CONFLICT (referrer_company_id, referred_company_id) DO NOTHING;
