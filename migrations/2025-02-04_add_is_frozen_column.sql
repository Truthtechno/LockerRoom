-- Add is_frozen column to users table for account freeze functionality
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_frozen BOOLEAN DEFAULT false;

-- Add index for efficient frozen account queries
CREATE INDEX IF NOT EXISTS idx_users_is_frozen ON users(is_frozen) WHERE is_frozen = true;

