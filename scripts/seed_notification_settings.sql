-- Seed notification_settings table with default notification types
-- Run this script in your Supabase SQL editor

-- Clear existing default settings (optional - remove if you want to keep existing data)
-- DELETE FROM notification_settings WHERE user_id IS NULL;

-- Insert default notification settings (system-wide, not user-specific)
INSERT INTO notification_settings (id, user_id, setting_type, label, system, email, sms, category, target_role)
VALUES
  (gen_random_uuid(), NULL, 'status_change', 'Zmiana statusu', true, true, false, NULL, NULL),
  (gen_random_uuid(), NULL, 'test_passed', 'Zaliczony test', true, false, false, NULL, NULL),
  (gen_random_uuid(), NULL, 'doc_uploaded', 'Nowy dokument', true, true, false, NULL, NULL),
  (gen_random_uuid(), NULL, 'candidate_link', 'Wysłanie linku', false, true, true, NULL, NULL),
  (gen_random_uuid(), NULL, 'trial_ending', 'Koniec okresu próbnego', true, true, false, NULL, NULL),
  (gen_random_uuid(), NULL, 'termination', 'Zwolnienie pracownika', true, true, false, NULL, NULL)
ON CONFLICT (user_id, setting_type) DO NOTHING;

-- Verify the data was inserted
SELECT * FROM notification_settings WHERE user_id IS NULL ORDER BY label;
