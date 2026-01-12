# Database Scripts

## 🔧 Notification Settings UUID Error Fix

### ❌ Error Message
```
"Error saving notification settings:"
"{\"code\":\"22P02\",\"details\":null,\"hint\":null,\"message\":\"invalid input syntax for type uuid: \\\"hr_cand_reg\\\"\"}"
```

### 🔍 Root Cause
The notification settings feature had corrupted data where `setting_type` values (like "hr_cand_reg") were incorrectly stored in the `target_role` UUID field, causing PostgreSQL type validation errors.

### ✅ Solution Applied

1. **Updated TypeScript Interface** (`types.ts`)
   - Added `setting_type` field for notification type identifier
   - Properly mapped `id` as UUID primary key
   - Added optional fields: `user_id`, `category`, `target_role`

2. **Fixed Database Operations** (`context/AppContext.tsx`)
   - `updateNotificationSettings()` now correctly saves to Supabase
   - Loads notification settings on app initialization
   - Fixed `triggerNotification()` to use `setting_type` instead of `id`

3. **Enhanced Error Handling** (`pages/hr/Settings.tsx`)
   - Added async/await for notification settings save
   - Displays user-friendly error messages

---

## 🚀 REQUIRED: Database Setup

**⚠️ YOU MUST RUN THIS SQL SCRIPT TO FIX THE ERROR**

### Step 1: Open Supabase SQL Editor

1. Go to your Supabase project: https://supabase.com/dashboard
2. Select your project: **MaxMaster-Skill_Platform**
3. Navigate to: **SQL Editor** (left sidebar)
4. Click: **+ New query**

### Step 2: Run the Fix Script

1. Open the file: `scripts/seed_notification_settings.sql`
2. Copy the **ENTIRE** contents of that file
3. Paste into the Supabase SQL Editor
4. Click: **Run** (or press `Ctrl+Enter`)

### Step 3: Verify Success

You should see output showing:
- Current data (may show corrupted entries)
- "After deletion - should be 0 rows" → should show `0`
- "Final verification - should be 6 rows" → should show **6 clean rows**:
  - Zmiana statusu
  - Zaliczony test
  - Nowy dokument
  - Wysłanie linku
  - Koniec okresu próbnego
  - Zwolnienie pracownika

### Step 4: Restart Your Application

After running the SQL script:
```bash
# Stop the dev server (Ctrl+C)
# Restart it
npm run dev
```

### Step 5: Test the Fix

1. Log in as **HR** user
2. Go to: **Ustawienia** (Settings)
3. Click tab: **POWIADOMIENIA** (Notifications)
4. Toggle any checkbox (System/Email/SMS)
5. Click: **Zapisz Preferencje** (Save Preferences)
6. ✅ No errors should appear!

---

## 📊 Database Schema

```sql
create table public.notification_settings (
  id uuid not null default gen_random_uuid (),           -- Primary key
  user_id uuid null,                                      -- NULL = system-wide setting
  setting_type character varying(100) not null,          -- e.g., "status_change"
  label character varying(255) not null,                 -- Display name
  system boolean null default true,                      -- Show in system notifications
  email boolean null default false,                      -- Send email
  sms boolean null default false,                        -- Send SMS
  created_at timestamp without time zone null default now(),
  updated_at timestamp without time zone null default now(),
  category text null,                                    -- Optional grouping
  target_role uuid null,                                 -- Optional role filtering

  constraint notification_settings_pkey primary key (id),
  constraint notification_settings_user_id_setting_type_key unique (user_id, setting_type),
  constraint notification_settings_user_id_fkey foreign key (user_id) references users (id) on delete cascade
);
```

### Field Mapping

| Database Field | TypeScript Field | Purpose | Example |
|---------------|------------------|---------|---------|
| `id` | `id` | UUID primary key | `"a1b2c3d4-..."` |
| `setting_type` | `setting_type` | Notification type | `"status_change"` |
| `label` | `label` | Display name | `"Zmiana statusu"` |
| `user_id` | `user_id` | User override (NULL = default) | `NULL` or user UUID |
| `system` | `system` | System notification enabled | `true`/`false` |
| `email` | `email` | Email notification enabled | `true`/`false` |
| `sms` | `sms` | SMS notification enabled | `true`/`false` |

---

## 🐛 Troubleshooting

### Error still occurs after running script

1. **Check if script ran completely**:
   ```sql
   SELECT COUNT(*) FROM notification_settings WHERE user_id IS NULL;
   ```
   Should return `6`. If not, run the script again.

2. **Check for duplicate entries**:
   ```sql
   SELECT setting_type, COUNT(*)
   FROM notification_settings
   WHERE user_id IS NULL
   GROUP BY setting_type
   HAVING COUNT(*) > 1;
   ```
   Should return no rows. If there are duplicates, run:
   ```sql
   DELETE FROM notification_settings WHERE user_id IS NULL;
   ```
   Then re-run the seed script.

3. **Check data types**:
   ```sql
   SELECT
     pg_typeof(id) as id_type,
     pg_typeof(user_id) as user_id_type,
     pg_typeof(setting_type) as setting_type_type,
     pg_typeof(target_role) as target_role_type
   FROM notification_settings
   WHERE user_id IS NULL
   LIMIT 1;
   ```
   Expected:
   - `id_type`: `uuid`
   - `user_id_type`: `uuid`
   - `setting_type_type`: `character varying`
   - `target_role_type`: `uuid`

4. **Clear browser cache** and reload the page

5. **Check browser console** for detailed error messages

### "Sync error" message

This occurs when Supabase real-time subscriptions try to sync corrupted data. After running the fix script and restarting the app, this should disappear.

---

## 📝 Code Changes Summary

### Before (Incorrect)
```typescript
// Trying to use setting_type as id
{ id: 'status_change', label: 'Zmiana statusu', ... }
                ↓
        Saved as UUID → ERROR!
```

### After (Correct)
```typescript
// Proper UUID id, separate setting_type
{
  id: 'a1b2c3d4-e5f6-...',      // UUID from database
  setting_type: 'status_change', // String identifier
  label: 'Zmiana statusu',
  ...
}
```

---

## ✅ Verification Checklist

- [ ] SQL script executed in Supabase
- [ ] Query returns 6 notification settings
- [ ] Application restarted
- [ ] No console errors on page load
- [ ] Can toggle notification checkboxes
- [ ] "Zapisz Preferencje" saves without errors
- [ ] Settings persist after page reload
