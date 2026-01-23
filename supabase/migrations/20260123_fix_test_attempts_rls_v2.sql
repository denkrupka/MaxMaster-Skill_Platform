-- Fix RLS policies for test_attempts table (Version 2)
-- This allows BOTH authenticated users AND candidates who haven't confirmed email yet

-- Enable RLS if not already enabled
ALTER TABLE test_attempts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view own test attempts" ON test_attempts;
DROP POLICY IF EXISTS "Users can insert own test attempts" ON test_attempts;
DROP POLICY IF EXISTS "HR and ADMIN can view all test attempts" ON test_attempts;
DROP POLICY IF EXISTS "Candidates can insert test attempts" ON test_attempts;
DROP POLICY IF EXISTS "Anyone can insert test attempts" ON test_attempts;

-- Policy 1: Authenticated users can view their own test attempts
CREATE POLICY "Users can view own test attempts"
  ON test_attempts FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND user_id = auth.uid()
  );

-- Policy 2: CRITICAL FIX - Allow inserts for candidates who exist in users table
-- This works for both:
-- - Authenticated users (after email confirmation)
-- - Candidates who haven't confirmed email yet (but exist in users table)
CREATE POLICY "Candidates can insert test attempts"
  ON test_attempts FOR INSERT
  WITH CHECK (
    -- Check if user_id exists in users table
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = test_attempts.user_id
    )
  );

-- Policy 3: HR and ADMIN can view all test attempts
CREATE POLICY "HR and ADMIN can view all test attempts"
  ON test_attempts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'hr')
    )
  );

-- Add comment for documentation
COMMENT ON TABLE test_attempts IS 'Stores all test attempts by users. RLS enabled: users can insert if they exist in users table (works for unconfirmed candidates), authenticated users can view their own, HR/ADMIN can view all.';
