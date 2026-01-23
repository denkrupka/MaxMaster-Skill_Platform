-- Fix RLS policies for test_attempts table
-- This allows users to submit their test results

-- Enable RLS if not already enabled
ALTER TABLE test_attempts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view own test attempts" ON test_attempts;
DROP POLICY IF EXISTS "Users can insert own test attempts" ON test_attempts;
DROP POLICY IF EXISTS "HR and ADMIN can view all test attempts" ON test_attempts;

-- Policy 1: Users can view their own test attempts
CREATE POLICY "Users can view own test attempts"
  ON test_attempts FOR SELECT
  USING (user_id = auth.uid());

-- Policy 2: Users can insert their own test attempts
CREATE POLICY "Users can insert own test attempts"
  ON test_attempts FOR INSERT
  WITH CHECK (user_id = auth.uid());

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
COMMENT ON TABLE test_attempts IS 'Stores all test attempts by users. RLS enabled: users can only insert/view their own attempts, HR/ADMIN can view all.';
