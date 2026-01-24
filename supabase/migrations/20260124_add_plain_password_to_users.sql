-- Add plain_password column to users table for admin visibility
-- Note: This stores passwords in plain text for admin reference only

ALTER TABLE users ADD COLUMN IF NOT EXISTS plain_password TEXT;

-- Add comment to clarify purpose
COMMENT ON COLUMN users.plain_password IS 'Plain text password for admin reference. Set when user is created by admin.';
