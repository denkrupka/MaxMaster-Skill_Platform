-- =====================================================
-- Add DELETE policy for companies table
-- Fix: Companies deletion was blocked by RLS (no DELETE policy existed)
-- =====================================================

-- Add DELETE policy for companies table
-- Only superadmins can delete companies
CREATE POLICY "Superadmins can delete companies" ON companies
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'superadmin'
    )
  );

-- Also add DELETE policies for related tables that might not have them

-- company_modules DELETE policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'company_modules'
    AND policyname LIKE '%delete%'
  ) THEN
    CREATE POLICY "Superadmins can delete company_modules" ON company_modules
      FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.role = 'superadmin'
        )
      );
  END IF;
END $$;

-- bonus_transactions DELETE policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'bonus_transactions'
    AND policyname LIKE '%delete%'
  ) THEN
    CREATE POLICY "Superadmins can delete bonus_transactions" ON bonus_transactions
      FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.role = 'superadmin'
        )
      );
  END IF;
END $$;

-- subscription_history DELETE policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'subscription_history'
    AND policyname LIKE '%delete%'
  ) THEN
    CREATE POLICY "Superadmins can delete subscription_history" ON subscription_history
      FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.role = 'superadmin'
        )
      );
  END IF;
END $$;

-- module_user_access DELETE policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'module_user_access'
    AND policyname LIKE '%delete%'
  ) THEN
    CREATE POLICY "Superadmins can delete module_user_access" ON module_user_access
      FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.role = 'superadmin'
        )
      );
  END IF;
END $$;
