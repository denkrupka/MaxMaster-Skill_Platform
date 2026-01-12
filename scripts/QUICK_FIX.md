# ⚡ Quick Fix for UUID Error

## Copy This SQL Script

**Open Supabase SQL Editor and paste this entire script:**

```sql
-- Delete corrupted data
DELETE FROM notification_settings WHERE user_id IS NULL;

-- Insert clean data
INSERT INTO notification_settings (id, user_id, setting_type, label, system, email, sms, category, target_role)
VALUES
  (gen_random_uuid(), NULL, 'status_change', 'Zmiana statusu', true, true, false, NULL, NULL),
  (gen_random_uuid(), NULL, 'test_passed', 'Zaliczony test', true, false, false, NULL, NULL),
  (gen_random_uuid(), NULL, 'doc_uploaded', 'Nowy dokument', true, true, false, NULL, NULL),
  (gen_random_uuid(), NULL, 'candidate_link', 'Wysłanie linku', false, true, true, NULL, NULL),
  (gen_random_uuid(), NULL, 'trial_ending', 'Koniec okresu próbnego', true, true, false, NULL, NULL),
  (gen_random_uuid(), NULL, 'termination', 'Zwolnienie pracownika', true, true, false, NULL, NULL);

-- Verify
SELECT * FROM notification_settings WHERE user_id IS NULL ORDER BY label;
```

## Then

1. Restart your dev server
2. Reload the page
3. Test Settings → Notifications tab

That's it! ✅
