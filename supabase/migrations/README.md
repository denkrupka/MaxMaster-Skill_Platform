# Database Migrations

## How to Apply Migrations

Execute these SQL commands in your Supabase SQL Editor (SQL Editor → New Query):

### ⚠️ CRITICAL: Migration: 20260123_fix_test_attempts_rls_v3.sql

**THIS MIGRATION IS REQUIRED** to fix the error: `new row violates row-level security policy for table "test_attempts"`

**IMPORTANT:** This is version 3 (FINAL) - uses SECURITY DEFINER function to bypass RLS on users table.

This error prevents users from submitting test results. Apply this migration immediately:

1. Open [Supabase SQL Editor](https://diytvuczpciikzdhldny.supabase.co/project/diytvuczpciikzdhldny/sql/new)
2. Copy and paste the **entire content** of `supabase/migrations/20260123_fix_test_attempts_rls_v3.sql`
3. Click **Run** to execute
4. Refresh your application and test again

**What this migration does:**
- Creates `check_user_exists()` SECURITY DEFINER function to bypass RLS on users table
- Enables Row Level Security (RLS) on `test_attempts` table
- ⭐ **Allows candidates to INSERT test attempts even BEFORE email confirmation** (via SECURITY DEFINER function)
- Allows authenticated users to SELECT their own test attempts
- Allows HR and ADMIN roles to view all test attempts

**Why version 3:**
- Version 1: Used `auth.uid()` → failed for unauthenticated candidates
- Version 2: Used `EXISTS (SELECT FROM users)` → failed because `users` table also has RLS blocking anonymous access
- Version 3: Uses SECURITY DEFINER function → bypasses RLS on users table, works for all users

**Security:**
- SECURITY DEFINER function only checks if user ID exists (no data leakage)
- `SET search_path = public` prevents SQL injection
- Cannot insert test_attempts for non-existent users

After applying this migration, the test submission will work correctly for both confirmed and unconfirmed candidates.

---

### Migration: 20260121_add_required_documents_to_positions.sql

```sql
-- Add required_document_ids column to positions table
ALTER TABLE positions
ADD COLUMN IF NOT EXISTS required_document_ids TEXT[];

-- Add comment for documentation
COMMENT ON COLUMN positions.required_document_ids IS 'Optional: Array of required document/certification IDs for this position. Used in hourly wage range calculations.';
```

After executing the migration, refresh your application.

## Quick Fix

If you see errors about `required_document_ids` column not found, run this command in Supabase SQL Editor:

```sql
ALTER TABLE positions ADD COLUMN IF NOT EXISTS required_document_ids TEXT[];
```
