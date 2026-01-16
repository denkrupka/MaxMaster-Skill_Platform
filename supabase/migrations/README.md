# Database Migrations

This folder contains SQL migration scripts for the Supabase database.

## How to Run Migrations

### Option 1: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard: https://diytvuczpciikzdhldny.supabase.co
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy and paste the contents of the migration file
5. Click **Run** to execute the migration

### Option 2: Using Supabase CLI

If you have Supabase CLI installed:

```bash
# Login to Supabase
supabase login

# Link your project
supabase link --project-ref diytvuczpciikzdhldny

# Run migrations
supabase db push
```

## Migration Files

- `20260116_add_questions_to_display.sql` - Adds questions_to_display column to tests table for randomized question limiting

## Important Notes

- Always backup your database before running migrations
- Migrations should be run in chronological order (by filename date)
- Test migrations in a development environment first if possible
