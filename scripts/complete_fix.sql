-- ============================================================================
-- COMPREHENSIVE FIX: Notification Settings - Complete Database Setup
-- ============================================================================
-- This script ensures the table has the correct structure and data
-- Run this ENTIRE script in your Supabase SQL Editor
-- ============================================================================

-- STEP 1: Check if the table exists and show its structure
SELECT
  'Step 1: Current table structure' as info,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'notification_settings'
ORDER BY ordinal_position;

-- STEP 2: Check existing constraints
SELECT
  'Step 2: Current constraints' as info,
  constraint_name,
  constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'notification_settings';

-- STEP 3: Drop the table if it exists (to start fresh)
DROP TABLE IF EXISTS notification_settings CASCADE;

-- STEP 4: Create the table with correct structure
CREATE TABLE IF NOT EXISTS notification_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NULL,
  setting_type character varying(100) NOT NULL,
  label character varying(255) NOT NULL,
  system boolean NULL DEFAULT true,
  email boolean NULL DEFAULT false,
  sms boolean NULL DEFAULT false,
  created_at timestamp without time zone NULL DEFAULT now(),
  updated_at timestamp without time zone NULL DEFAULT now(),
  category text NULL,
  target_role text NULL,

  CONSTRAINT notification_settings_pkey PRIMARY KEY (id),
  CONSTRAINT notification_settings_user_id_setting_type_key UNIQUE (user_id, setting_type)
);

-- Note: We're NOT adding the foreign key constraint to users table yet
-- because it might fail if users table doesn't exist or has issues
-- If you need it, uncomment the line below:
-- ALTER TABLE notification_settings ADD CONSTRAINT notification_settings_user_id_fkey
--   FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;

-- STEP 5: Create the update trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- STEP 6: Create the trigger
DROP TRIGGER IF EXISTS notification_settings_updated_at ON notification_settings;
CREATE TRIGGER notification_settings_updated_at
  BEFORE UPDATE ON notification_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- STEP 7: Insert default notification settings
INSERT INTO notification_settings (
  id,
  user_id,
  setting_type,
  label,
  system,
  email,
  sms,
  category,
  target_role
)
VALUES
  (gen_random_uuid(), NULL, 'status_change', 'Zmiana statusu', true, true, false, NULL, NULL),
  (gen_random_uuid(), NULL, 'test_passed', 'Zaliczony test', true, false, false, NULL, NULL),
  (gen_random_uuid(), NULL, 'doc_uploaded', 'Nowy dokument', true, true, false, NULL, NULL),
  (gen_random_uuid(), NULL, 'candidate_link', 'Wysłanie linku', false, true, true, NULL, NULL),
  (gen_random_uuid(), NULL, 'trial_ending', 'Koniec okresu próbnego', true, true, false, NULL, NULL),
  (gen_random_uuid(), NULL, 'termination', 'Zwolnienie pracownika', true, true, false, NULL, NULL);

-- STEP 8: Verify the data was inserted
SELECT
  'Step 8: Verification - should show 6 rows' as info,
  COUNT(*) as total_rows
FROM notification_settings
WHERE user_id IS NULL;

-- STEP 9: Show all data
SELECT
  'Step 9: All notification settings' as info,
  id,
  user_id,
  setting_type,
  label,
  system,
  email,
  sms,
  category,
  target_role
FROM notification_settings
WHERE user_id IS NULL
ORDER BY label;

-- STEP 10: Verify data types
SELECT
  'Step 10: Data type verification' as info,
  pg_typeof(id) as id_type,
  pg_typeof(user_id) as user_id_type,
  pg_typeof(setting_type) as setting_type_type,
  pg_typeof(target_role) as target_role_type
FROM notification_settings
WHERE user_id IS NULL
LIMIT 1;

-- STEP 11: Verify constraints exist
SELECT
  'Step 11: Final constraint check' as info,
  constraint_name,
  constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'notification_settings';

-- ============================================================================
-- SUCCESS! If you see 6 rows in Step 8 and data in Step 9, you're all set!
-- Next steps:
-- 1. Restart your application (Ctrl+C, then npm run dev)
-- 2. Test the notifications settings page
-- ============================================================================
