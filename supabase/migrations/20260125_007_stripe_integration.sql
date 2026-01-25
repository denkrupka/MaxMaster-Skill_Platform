-- =============================================
-- Stripe Integration Schema Updates
-- =============================================

-- Add Stripe columns to company_modules if not exists
ALTER TABLE company_modules
ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS stripe_subscription_item_id VARCHAR(255);

-- Create payment_history table
CREATE TABLE IF NOT EXISTS payment_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    stripe_invoice_id VARCHAR(255),
    stripe_payment_intent_id VARCHAR(255),
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'PLN',
    status VARCHAR(50) NOT NULL, -- paid, failed, pending, refunded
    invoice_number VARCHAR(100),
    invoice_pdf_url TEXT,
    description TEXT,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_payment_history_company ON payment_history(company_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_stripe_invoice ON payment_history(stripe_invoice_id);
CREATE INDEX IF NOT EXISTS idx_company_modules_stripe_sub ON company_modules(stripe_subscription_id);

-- Enable RLS on payment_history
ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;

-- RLS policy for payment_history - company admins can view their company's payments
CREATE POLICY "Company admins can view their payment history" ON payment_history
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND (u.company_id = payment_history.company_id AND u.role = 'company_admin')
        )
        OR
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.role IN ('superadmin', 'admin')
        )
    );

-- Grant permissions
GRANT SELECT ON payment_history TO authenticated;
