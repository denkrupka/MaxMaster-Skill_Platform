-- =====================================================
-- MULTI-COMPANY SUPPORT - Part 2: Modules & Subscriptions
-- =====================================================

-- Create modules reference table (available modules in the system)
CREATE TABLE IF NOT EXISTS modules (
  code VARCHAR(50) PRIMARY KEY,
  name_pl VARCHAR(100) NOT NULL,
  name_en VARCHAR(100),
  description_pl TEXT,
  description_en TEXT,

  -- Which roles are available in this module
  available_roles TEXT[] NOT NULL,

  -- Base pricing
  base_price_per_user DECIMAL(10,2) NOT NULL,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,

  -- Icon for UI
  icon VARCHAR(50),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default modules
INSERT INTO modules (code, name_pl, name_en, description_pl, description_en, available_roles, base_price_per_user, is_active, display_order, icon) VALUES
  ('recruitment', 'Rekrutacja', 'Recruitment',
   'Moduł rekrutacji kandydatów i zarządzania okresem próbnym',
   'Candidate recruitment and trial period management module',
   ARRAY['candidate', 'trial'],
   59.00, TRUE, 1, 'UserPlus'),
  ('skills', 'Umiejętności', 'Skills',
   'Moduł zarządzania umiejętnościami i rozwojem pracowników',
   'Employee skills management and development module',
   ARRAY['employee', 'brigadir', 'coordinator'],
   79.00, TRUE, 2, 'Award')
ON CONFLICT (code) DO NOTHING;

-- Create company_modules table (which modules a company has purchased)
CREATE TABLE IF NOT EXISTS company_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  module_code VARCHAR(50) NOT NULL REFERENCES modules(code),

  -- Limits
  max_users INTEGER NOT NULL DEFAULT 10,
  current_users INTEGER DEFAULT 0,

  -- Pricing (can override base price)
  price_per_user DECIMAL(10,2) NOT NULL,
  billing_cycle VARCHAR(20) DEFAULT 'monthly', -- monthly, yearly

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  activated_at TIMESTAMPTZ DEFAULT NOW(),
  deactivated_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(company_id, module_code)
);

-- Create indexes for company_modules
CREATE INDEX IF NOT EXISTS idx_company_modules_company ON company_modules(company_id);
CREATE INDEX IF NOT EXISTS idx_company_modules_module ON company_modules(module_code);
CREATE INDEX IF NOT EXISTS idx_company_modules_active ON company_modules(is_active);

-- Enable RLS
ALTER TABLE company_modules ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their company modules" ON company_modules
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow insert for authenticated" ON company_modules
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow update for authenticated" ON company_modules
  FOR UPDATE
  TO authenticated
  USING (true);

-- Create module_user_access table (which users have access to which modules)
CREATE TABLE IF NOT EXISTS module_user_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  module_code VARCHAR(50) NOT NULL REFERENCES modules(code),

  is_enabled BOOLEAN DEFAULT TRUE,
  enabled_at TIMESTAMPTZ DEFAULT NOW(),
  disabled_at TIMESTAMPTZ,

  -- For prorated billing calculation
  days_used INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, module_code)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_module_user_access_company ON module_user_access(company_id);
CREATE INDEX IF NOT EXISTS idx_module_user_access_user ON module_user_access(user_id);
CREATE INDEX IF NOT EXISTS idx_module_user_access_module ON module_user_access(module_code);
CREATE INDEX IF NOT EXISTS idx_module_user_access_enabled ON module_user_access(is_enabled);

-- Enable RLS
ALTER TABLE module_user_access ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view module access" ON module_user_access
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow insert for authenticated" ON module_user_access
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow update for authenticated" ON module_user_access
  FOR UPDATE
  TO authenticated
  USING (true);

-- Add trigger for updated_at on company_modules
CREATE OR REPLACE FUNCTION update_company_modules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_company_modules_updated_at
  BEFORE UPDATE ON company_modules
  FOR EACH ROW
  EXECUTE FUNCTION update_company_modules_updated_at();

-- Add comments
COMMENT ON TABLE modules IS 'Available system modules (recruitment, skills, etc.)';
COMMENT ON TABLE company_modules IS 'Modules purchased by each company';
COMMENT ON TABLE module_user_access IS 'Per-user module access control';
COMMENT ON COLUMN module_user_access.days_used IS 'Days used in current billing period for prorated calculation';
