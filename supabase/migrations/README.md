# Database Migrations

## How to Apply Migrations

Execute these SQL commands in your Supabase SQL Editor (SQL Editor → New Query):

### ⚠️ CRITICAL: Migration: 20260123_fix_test_attempts_rls.sql

**THIS MIGRATION IS REQUIRED** to fix the error: `new row violates row-level security policy for table "test_attempts"`

This error prevents users from submitting test results. Apply this migration immediately:

1. Open [Supabase SQL Editor](https://diytvuczpciikzdhldny.supabase.co/project/diytvuczpciikzdhldny/sql/new)
2. Copy and paste the **entire content** of `supabase/migrations/20260123_fix_test_attempts_rls.sql`
3. Click **Run** to execute
4. Refresh your application and test again

**What this migration does:**
- Enables Row Level Security (RLS) on `test_attempts` table
- Allows users to INSERT their own test attempts
- Allows users to SELECT their own test attempts
- Allows HR and ADMIN roles to view all test attempts

After applying this migration, the test submission will work correctly.

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
