-- Migration: Add RLS policy for positions table to allow all authenticated users to read
-- This enables employees to see positions and referral bonuses

-- Enable RLS if not already enabled
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;

-- Drop existing select policy if exists (to avoid conflicts)
DROP POLICY IF EXISTS "positions_select_authenticated" ON positions;

-- Create policy allowing all authenticated users to read positions
CREATE POLICY "positions_select_authenticated" ON positions
    FOR SELECT
    TO authenticated
    USING (true);

-- Note: Write policies (INSERT, UPDATE, DELETE) should remain restricted to HR/admin roles
-- This migration only adds read access for all authenticated users
