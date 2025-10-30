-- Add announcement support to posts table
-- This migration extends the posts table to support announcements created by admins

-- Add new columns to posts table
ALTER TABLE posts ADD COLUMN IF NOT EXISTS type text DEFAULT 'post' CHECK (type IN ('post', 'announcement'));
ALTER TABLE posts ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS broadcast boolean DEFAULT false;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS scope text DEFAULT 'school' CHECK (scope IN ('school', 'global', 'staff'));
ALTER TABLE posts ADD COLUMN IF NOT EXISTS school_id varchar;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS created_by_admin_id varchar;

-- Make studentId nullable for announcements (announcements don't have a studentId)
ALTER TABLE posts ALTER COLUMN student_id DROP NOT NULL;

-- Make mediaUrl nullable for text-only announcements
ALTER TABLE posts ALTER COLUMN media_url DROP NOT NULL;

-- Make mediaType nullable for text-only announcements  
ALTER TABLE posts ALTER COLUMN media_type DROP NOT NULL;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_posts_type ON posts(type);
CREATE INDEX IF NOT EXISTS idx_posts_scope ON posts(scope);
CREATE INDEX IF NOT EXISTS idx_posts_school_id ON posts(school_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_by_admin_id ON posts(created_by_admin_id);
CREATE INDEX IF NOT EXISTS idx_posts_broadcast ON posts(broadcast);

-- Add foreign key constraints
ALTER TABLE posts ADD CONSTRAINT fk_posts_school_id FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE posts ADD CONSTRAINT fk_posts_created_by_admin_id FOREIGN KEY (created_by_admin_id) REFERENCES users(id) ON DELETE SET NULL;

-- Update existing posts to have type='post'
UPDATE posts SET type = 'post' WHERE type IS NULL;
