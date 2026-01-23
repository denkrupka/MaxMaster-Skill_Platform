-- Add user blocking fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS blocked_reason TEXT;

-- Add index for faster queries on blocked users
CREATE INDEX IF NOT EXISTS idx_users_is_blocked ON users(is_blocked);
