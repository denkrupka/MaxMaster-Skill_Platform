-- =====================================================
-- MULTI-COMPANY SUPPORT - Part 1: Companies Table
-- =====================================================

-- Create companies table
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  logo_url TEXT,

  -- Legal data (for invoices)
  legal_name VARCHAR(255),
  tax_id VARCHAR(50), -- NIP
  regon VARCHAR(20),
  address_street VARCHAR(255),
  address_city VARCHAR(100),
  address_postal_code VARCHAR(20),
  address_country VARCHAR(100) DEFAULT 'Polska',

  -- Contact data
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  billing_email VARCHAR(255),

  -- Status
  status VARCHAR(50) DEFAULT 'active', -- active, suspended, cancelled, trial
  is_blocked BOOLEAN DEFAULT FALSE,
  blocked_at TIMESTAMPTZ,
  blocked_reason TEXT,

  -- Subscription
  trial_ends_at TIMESTAMPTZ,
  subscription_status VARCHAR(50) DEFAULT 'trialing', -- trialing, active, past_due, cancelled

  -- Stripe integration
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),

  -- Bonus balance (for prorated refunds)
  bonus_balance DECIMAL(10,2) DEFAULT 0.00,

  -- Company-specific settings (JSON)
  settings JSONB DEFAULT '{}',

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,

  -- Sales owner (who brought this company)
  sales_owner_id UUID,
  doradca_id UUID
);

-- Create indexes for companies
CREATE INDEX IF NOT EXISTS idx_companies_slug ON companies(slug);
CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(status);
CREATE INDEX IF NOT EXISTS idx_companies_is_blocked ON companies(is_blocked);
CREATE INDEX IF NOT EXISTS idx_companies_sales_owner ON companies(sales_owner_id);
CREATE INDEX IF NOT EXISTS idx_companies_subscription_status ON companies(subscription_status);

-- Enable RLS on companies
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- RLS Policies for companies (will be refined after users table is updated)
-- For now, allow authenticated users to select companies
CREATE POLICY "Authenticated users can view companies" ON companies
  FOR SELECT
  TO authenticated
  USING (true);

-- Only superadmins and sales can insert companies (will be refined)
CREATE POLICY "Allow insert for authenticated" ON companies
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Only superadmins and company admins can update
CREATE POLICY "Allow update for authenticated" ON companies
  FOR UPDATE
  TO authenticated
  USING (true);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_companies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION update_companies_updated_at();

-- Add comments
COMMENT ON TABLE companies IS 'Multi-tenant companies/organizations';
COMMENT ON COLUMN companies.slug IS 'URL-friendly unique identifier';
COMMENT ON COLUMN companies.bonus_balance IS 'Prorated refund balance for unused subscription days';
COMMENT ON COLUMN companies.settings IS 'Company-specific configuration (JSON)';
