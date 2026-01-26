-- Create bonus_transactions table to track bonus balance changes
CREATE TABLE IF NOT EXISTS bonus_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  type VARCHAR(10) NOT NULL CHECK (type IN ('credit', 'debit')),
  description TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_bonus_transactions_company_id ON bonus_transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_bonus_transactions_created_at ON bonus_transactions(created_at DESC);

-- Create subscription_history table to track subscription changes
CREATE TABLE IF NOT EXISTS subscription_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  module_code VARCHAR(50),
  details TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_subscription_history_company_id ON subscription_history(company_id);
CREATE INDEX IF NOT EXISTS idx_subscription_history_created_at ON subscription_history(created_at DESC);

-- Enable RLS
ALTER TABLE bonus_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to allow re-running migration)
DROP POLICY IF EXISTS "Allow superadmin full access to bonus_transactions" ON bonus_transactions;
DROP POLICY IF EXISTS "Allow sales read access to bonus_transactions" ON bonus_transactions;
DROP POLICY IF EXISTS "Allow superadmin full access to subscription_history" ON subscription_history;
DROP POLICY IF EXISTS "Allow sales read access to subscription_history" ON subscription_history;
DROP POLICY IF EXISTS "Allow company_admin read own company subscription_history" ON subscription_history;

-- Create RLS policies for bonus_transactions
CREATE POLICY "Allow superadmin full access to bonus_transactions"
  ON bonus_transactions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'superadmin'
    )
  );

CREATE POLICY "Allow sales read access to bonus_transactions"
  ON bonus_transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'sales'
    )
  );

-- Create RLS policies for subscription_history
CREATE POLICY "Allow superadmin full access to subscription_history"
  ON subscription_history FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'superadmin'
    )
  );

CREATE POLICY "Allow sales read access to subscription_history"
  ON subscription_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'sales'
    )
  );

CREATE POLICY "Allow company_admin read own company subscription_history"
  ON subscription_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.company_id = subscription_history.company_id
      AND users.role = 'company_admin'
    )
  );
