# ⚡ Quick Fix for UUID/Constraint Error

## 🔴 If you see either of these errors:
- `"invalid input syntax for type uuid: \"hr_cand_reg\""`
- `"there is no unique or exclusion constraint matching the ON CONFLICT specification"`

## 🚀 Complete Fix (3 minutes)

**This script will recreate the table from scratch with correct structure:**

### Step 1: Open Supabase SQL Editor
1. Go to: https://supabase.com/dashboard
2. Select your project
3. Click: **SQL Editor** (left sidebar)
4. Click: **+ New query**

### Step 2: Copy and Run This Complete Fix

**Copy ALL of this and paste into Supabase SQL Editor:**

```sql
-- Drop and recreate the table with correct structure
DROP TABLE IF EXISTS notification_settings CASCADE;

CREATE TABLE notification_settings (
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
  target_role uuid NULL,

  CONSTRAINT notification_settings_pkey PRIMARY KEY (id),
  CONSTRAINT notification_settings_user_id_setting_type_key UNIQUE (user_id, setting_type)
);

-- Create update trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS notification_settings_updated_at ON notification_settings;
CREATE TRIGGER notification_settings_updated_at
  BEFORE UPDATE ON notification_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Insert default data
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

**Click RUN (or Ctrl+Enter)**

### Step 3: Verify Success
You should see **6 rows** in the output with proper UUIDs in the `id` field.

### Step 4: Restart Application
```bash
# Stop the dev server (Ctrl+C)
npm run dev
```

### Step 5: Test
1. Log in as HR
2. Go to: **Ustawienia** → **POWIADOMIENIA** tab
3. Toggle any checkbox
4. Click: **Zapisz Preferencje**
5. ✅ **Should work without errors!**

---

## 📝 What This Does
- **Drops** the old table (removes corrupted data)
- **Creates** the table with correct structure and constraints
- **Adds** the unique constraint that was missing
- **Inserts** 6 default notification settings
- **Creates** the update trigger for automatic timestamps

## ⚠️ Note
This will delete any existing notification settings. If you had custom settings, you'll need to recreate them after running this script.

---

## 🆘 Still Having Issues?
See `scripts/README.md` for detailed troubleshooting steps, or run `scripts/complete_fix.sql` which includes additional verification queries.
