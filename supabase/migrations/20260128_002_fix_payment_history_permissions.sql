-- Add INSERT permission for payment_history table
-- This allows superadmins and admins to insert bonus transactions and other payment records

-- Grant INSERT permission on payment_history to authenticated users
GRANT INSERT ON payment_history TO authenticated;

-- Add RLS policy for superadmins/admins to insert payment records
DROP POLICY IF EXISTS "Superadmins can insert payment history" ON payment_history;
CREATE POLICY "Superadmins can insert payment history" ON payment_history
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.role IN ('superadmin', 'admin')
        )
    );

-- Add RLS policy for sales users to view payment history of their linked companies
DROP POLICY IF EXISTS "Sales can view linked company payment history" ON payment_history;
CREATE POLICY "Sales can view linked company payment history" ON payment_history
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users u
            JOIN companies c ON c.sales_owner_id = u.id
            WHERE u.id = auth.uid()
            AND u.role = 'sales'
            AND c.id = payment_history.company_id
        )
    );
