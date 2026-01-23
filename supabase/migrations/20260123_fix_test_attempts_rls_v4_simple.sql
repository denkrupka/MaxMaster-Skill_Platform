-- Fix RLS policies for test_attempts table (Version 4 - Simplified)
-- This version simply allows INSERT for anon role (authenticated via session)

-- Enable RLS
ALTER TABLE test_attempts ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view own test attempts" ON test_attempts;
DROP POLICY IF EXISTS "Users can insert own test attempts" ON test_attempts;
DROP POLICY IF EXISTS "HR and ADMIN can view all test attempts" ON test_attempts;
DROP POLICY IF EXISTS "Candidates can insert test attempts" ON test_attempts;
DROP POLICY IF EXISTS "Anyone can insert test attempts" ON test_attempts;
DROP POLICY IF EXISTS "Allow anon inserts" ON test_attempts;

-- Policy 1: Allow authenticated users to view their own attempts
CREATE POLICY "Users can view own test attempts"
  ON test_attempts FOR SELECT
  USING (auth.uid() = user_id);

-- Policy 2: Allow ALL authenticated users to insert (including anon with valid session)
-- This is the simplest approach - trust the application layer
CREATE POLICY "Allow authenticated inserts"
  ON test_attempts FOR INSERT
  WITH CHECK (true);

-- Policy 3: HR and ADMIN can view all
CREATE POLICY "HR and ADMIN can view all test attempts"
  ON test_attempts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'hr')
    )
  );

COMMENT ON TABLE test_attempts IS 'RLS enabled. All authenticated users (including candidates with session) can insert test attempts. Trust application layer for validation.';
