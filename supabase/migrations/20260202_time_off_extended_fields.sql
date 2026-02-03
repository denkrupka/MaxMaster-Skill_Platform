-- Add extended fields to time_off_types
ALTER TABLE time_off_types ADD COLUMN IF NOT EXISTS shortcut VARCHAR(3);
ALTER TABLE time_off_types ADD COLUMN IF NOT EXISTS is_subtype BOOLEAN DEFAULT false;
ALTER TABLE time_off_types ADD COLUMN IF NOT EXISTS parent_type_id UUID REFERENCES time_off_types(id);
ALTER TABLE time_off_types ADD COLUMN IF NOT EXISTS pay_rate INTEGER DEFAULT 100;
ALTER TABLE time_off_types ADD COLUMN IF NOT EXISTS limit_days INTEGER;
ALTER TABLE time_off_types ADD COLUMN IF NOT EXISTS is_limited BOOLEAN DEFAULT false;
ALTER TABLE time_off_types ADD COLUMN IF NOT EXISTS count_holidays BOOLEAN DEFAULT false;
ALTER TABLE time_off_types ADD COLUMN IF NOT EXISTS count_weekends BOOLEAN DEFAULT false;
ALTER TABLE time_off_types ADD COLUMN IF NOT EXISTS carry_over BOOLEAN DEFAULT false;
ALTER TABLE time_off_types ADD COLUMN IF NOT EXISTS require_advance BOOLEAN DEFAULT false;
ALTER TABLE time_off_types ADD COLUMN IF NOT EXISTS auto_approve BOOLEAN DEFAULT false;
ALTER TABLE time_off_types ADD COLUMN IF NOT EXISTS default_comment TEXT;
ALTER TABLE time_off_types ADD COLUMN IF NOT EXISTS is_daily BOOLEAN DEFAULT true;

-- Add is_enabled field to time_off_limits for per-employee type availability
ALTER TABLE time_off_limits ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN DEFAULT true;
