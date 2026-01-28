-- Add payment_method and comment columns to payment_history table
-- payment_method indicates the source: 'stripe', 'bonus', 'mixed', 'portal' (superadmin)
-- comment stores any admin-provided comment

ALTER TABLE payment_history
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) DEFAULT 'stripe',
ADD COLUMN IF NOT EXISTS comment TEXT;

-- Add payment_type column to distinguish different types of payments
ALTER TABLE payment_history
ADD COLUMN IF NOT EXISTS payment_type VARCHAR(50);

-- Create index for payment_method for faster filtering
CREATE INDEX IF NOT EXISTS idx_payment_history_payment_method ON payment_history(payment_method);

-- Add RLS policy for company admins to read bonus transactions
DROP POLICY IF EXISTS "Allow company_admin read own company bonus_transactions" ON bonus_transactions;
CREATE POLICY "Allow company_admin read own company bonus_transactions"
  ON bonus_transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.company_id = bonus_transactions.company_id
      AND users.role = 'company_admin'
    )
  );
