-- Fix RLS for test_attempts - SIMPLE VERSION
-- Allow unauthenticated candidates to submit test results

-- Enable RLS
ALTER TABLE test_attempts ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies
DROP POLICY IF EXISTS "Users can view own test attempts" ON test_attempts;
DROP POLICY IF EXISTS "Users can insert own test attempts" ON test_attempts;
DROP POLICY IF EXISTS "HR and ADMIN can view all test attempts" ON test_attempts;
DROP POLICY IF EXISTS "Candidates can insert test attempts" ON test_attempts;
DROP POLICY IF EXISTS "Anyone can insert test attempts" ON test_attempts;
DROP POLICY IF EXISTS "Allow anon inserts" ON test_attempts;
DROP POLICY IF EXISTS "Allow authenticated inserts" ON test_attempts;
DROP POLICY IF EXISTS "Allow anon and authenticated inserts" ON test_attempts;

-- Policy 1: SIMPLE - Allow ALL to insert (anon and authenticated)
CREATE POLICY "Allow all to insert test attempts"
  ON test_attempts FOR INSERT
  WITH CHECK (true);

-- Policy 2: Authenticated users can view their own
CREATE POLICY "Authenticated users view own"
  ON test_attempts FOR SELECT
  USING (auth.uid() = user_id);

-- Policy 3: HR and ADMIN can view all
CREATE POLICY "HR and ADMIN view all"
  ON test_attempts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'hr')
    )
  );

-- Grant permissions
GRANT ALL ON test_attempts TO anon;
GRANT ALL ON test_attempts TO authenticated;

COMMENT ON TABLE test_attempts IS 'RLS enabled. Simple policy: anyone can insert (trust application layer), authenticated users view own, HR/ADMIN view all.';
