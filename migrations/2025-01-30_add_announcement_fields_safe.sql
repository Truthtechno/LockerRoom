-- Add announcement fields to posts table
-- This migration only adds new columns without modifying existing ones

-- Add announcement-specific columns
ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'post',
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS broadcast BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT 'school',
ADD COLUMN IF NOT EXISTS school_id VARCHAR(256),
ADD COLUMN IF NOT EXISTS created_by_admin_id VARCHAR(256);

-- Update existing posts to have type 'post' (only if type is NULL)
UPDATE posts SET type = 'post' WHERE type IS NULL;

-- Make studentId nullable for announcements (only if it's currently NOT NULL)
-- This is safe because we're only making it nullable, not changing the data type
ALTER TABLE posts ALTER COLUMN student_id DROP NOT NULL;

-- Make mediaUrl and mediaType nullable for text-only announcements
-- This is safe because we're only making them nullable, not changing the data type
ALTER TABLE posts ALTER COLUMN media_url DROP NOT NULL;
ALTER TABLE posts ALTER COLUMN media_type DROP NOT NULL;
