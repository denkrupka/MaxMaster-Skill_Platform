-- ============================================================================
-- FIX: Notification Settings UUID Error
-- ============================================================================
-- This script fixes the "invalid input syntax for type uuid" error
-- Run this entire script in your Supabase SQL Editor
-- ============================================================================

-- STEP 1: Check current data (for debugging)
SELECT
  'Current notification_settings data:' as info,
  id, user_id, setting_type, label, system, email, sms, category, target_role
FROM notification_settings
WHERE user_id IS NULL
ORDER BY label;

-- STEP 2: Delete ALL existing default notification settings
-- This removes any corrupted data
DELETE FROM notification_settings WHERE user_id IS NULL;

-- STEP 3: Verify table is empty
SELECT
  'After deletion - should be 0 rows:' as info,
  COUNT(*) as row_count
FROM notification_settings
WHERE user_id IS NULL;

-- STEP 4: Insert clean default notification settings
-- These will be the system-wide defaults
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

-- STEP 5: Verify the clean data was inserted correctly
SELECT
  'Final verification - should be 6 rows:' as info,
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

-- STEP 6: Check for any data type issues
SELECT
  'Data type check:' as info,
  pg_typeof(id) as id_type,
  pg_typeof(user_id) as user_id_type,
  pg_typeof(setting_type) as setting_type_type,
  pg_typeof(target_role) as target_role_type
FROM notification_settings
WHERE user_id IS NULL
LIMIT 1;
