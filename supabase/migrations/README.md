# Database Migrations

## How to Apply Migrations

Execute these SQL commands in your Supabase SQL Editor (SQL Editor → New Query):

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
