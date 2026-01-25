-- =============================================
-- Sales Actions Log Schema
-- Track all sales discounts and extensions
-- =============================================

-- Sales actions log table
CREATE TABLE IF NOT EXISTS sales_actions_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL, -- 'discount', 'extension', 'bonus'
    value NUMERIC NOT NULL, -- percentage for discount, days for extension, amount for bonus
    reason TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sales_actions_company ON sales_actions_log(company_id);
CREATE INDEX IF NOT EXISTS idx_sales_actions_sales_user ON sales_actions_log(sales_user_id);
CREATE INDEX IF NOT EXISTS idx_sales_actions_type ON sales_actions_log(action_type);
CREATE INDEX IF NOT EXISTS idx_sales_actions_created ON sales_actions_log(created_at DESC);

-- RLS
ALTER TABLE sales_actions_log ENABLE ROW LEVEL SECURITY;

-- SuperAdmin and Sales can view all logs
CREATE POLICY "Admins and sales can view sales actions" ON sales_actions_log
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.role IN ('superadmin', 'sales', 'admin')
        )
    );

-- Sales can insert logs
CREATE POLICY "Sales can insert actions" ON sales_actions_log
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.role IN ('superadmin', 'sales')
        )
    );

-- Grant permissions
GRANT SELECT, INSERT ON sales_actions_log TO authenticated;
