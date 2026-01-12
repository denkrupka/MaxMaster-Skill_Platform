# Database Scripts

## Notification Settings Setup

### Problem
The notification settings feature was saving `setting_type` values (like "hr_cand_reg") to the `target_role` UUID field, causing PostgreSQL errors.

### Solution
1. Updated the `NotificationSetting` TypeScript interface to match the database schema
2. Modified `updateNotificationSettings` to properly save settings to Supabase
3. Added loading of notification settings from database on app start

### Setup Instructions

1. **Run the seed script** in your Supabase SQL Editor:
   - Open your Supabase project dashboard
   - Go to SQL Editor
   - Copy and paste the contents of `seed_notification_settings.sql`
   - Run the script

2. **Verify the data**:
   ```sql
   SELECT * FROM notification_settings WHERE user_id IS NULL;
   ```
   You should see 6 default notification settings.

3. **Test the application**:
   - Log in as HR
   - Go to Settings > Notifications tab
   - Toggle checkboxes for System/Email/SMS
   - Click "Zapisz Preferencje" (Save Preferences)
   - Verify no errors appear in the console

### Database Schema

```sql
create table public.notification_settings (
  id uuid not null default gen_random_uuid (),
  user_id uuid null,
  setting_type character varying(100) not null,
  label character varying(255) not null,
  system boolean null default true,
  email boolean null default false,
  sms boolean null default false,
  created_at timestamp without time zone null default now(),
  updated_at timestamp without time zone null default now(),
  category text null,
  target_role uuid null,
  constraint notification_settings_pkey primary key (id),
  constraint notification_settings_user_id_setting_type_key unique (user_id, setting_type),
  constraint notification_settings_user_id_fkey foreign key (user_id) references users (id) on delete cascade
);
```

### Key Changes

- `id`: Now properly used as UUID primary key (auto-generated)
- `setting_type`: Stores the notification type identifier (e.g., "status_change")
- `user_id`: NULL for system-wide settings, user ID for user-specific overrides
- System correctly saves only `system`, `email`, `sms` fields on update
