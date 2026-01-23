-- Fix RLS policies for test_attempts table (Version 3 - FINAL)
-- This version uses SECURITY DEFINER function to bypass RLS on users table

-- Step 1: Create a SECURITY DEFINER function to check if user exists
-- This function runs with owner's permissions, bypassing RLS on users table
CREATE OR REPLACE FUNCTION public.check_user_exists(user_uuid UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM users WHERE id = user_uuid);
END;
$$;

-- Add comment to function
COMMENT ON FUNCTION public.check_user_exists IS 'Check if user exists in users table. SECURITY DEFINER allows this to work for unauthenticated users.';

-- Step 2: Enable RLS if not already enabled
ALTER TABLE test_attempts ENABLE ROW LEVEL SECURITY;

-- Step 3: Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Users can view own test attempts" ON test_attempts;
DROP POLICY IF EXISTS "Users can insert own test attempts" ON test_attempts;
DROP POLICY IF EXISTS "HR and ADMIN can view all test attempts" ON test_attempts;
DROP POLICY IF EXISTS "Candidates can insert test attempts" ON test_attempts;
DROP POLICY IF EXISTS "Anyone can insert test attempts" ON test_attempts;

-- Step 4: Create new policies

-- Policy 1: Authenticated users can view their own test attempts
CREATE POLICY "Users can view own test attempts"
  ON test_attempts FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND user_id = auth.uid()
  );

-- Policy 2: FINAL FIX - Allow inserts using SECURITY DEFINER function
-- This works for BOTH authenticated and unauthenticated users
-- The function bypasses RLS on users table to check if user exists
CREATE POLICY "Candidates can insert test attempts"
  ON test_attempts FOR INSERT
  WITH CHECK (
    check_user_exists(user_id)
  );

-- Policy 3: HR and ADMIN can view all test attempts
CREATE POLICY "HR and ADMIN can view all test attempts"
  ON test_attempts FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'hr')
    )
  );

-- Add comment for documentation
COMMENT ON TABLE test_attempts IS 'Stores all test attempts. RLS enabled: uses SECURITY DEFINER function to allow inserts for unconfirmed candidates.';
