-- Add is_enabled column to time_off_limits table
ALTER TABLE time_off_limits
ADD COLUMN IF NOT EXISTS is_enabled boolean DEFAULT true;
