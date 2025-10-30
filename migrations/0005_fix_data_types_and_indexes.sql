-- Migration: Fix data type mismatches and add performance indexes
-- Created: 2025-01-XX
-- Description: Fixes user_follows table to use varchar instead of UUID, and adds performance indexes

-- Drop existing user_follows table if it exists (in case it was created with wrong types)
DROP TABLE IF EXISTS user_follows;

-- Recreate user_follows table with correct varchar types to match users.id
CREATE TABLE user_follows (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id varchar NOT NULL,
  following_id varchar NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL,
  UNIQUE(follower_id, following_id)
);

-- Add foreign key constraints (optional but recommended for data integrity)
-- Note: These will be added after ensuring data consistency
-- ALTER TABLE user_follows ADD CONSTRAINT fk_user_follows_follower 
--   FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE;
-- ALTER TABLE user_follows ADD CONSTRAINT fk_user_follows_following 
--   FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE;

-- Create indexes for better query performance on user_follows
CREATE INDEX idx_user_follows_follower_id ON user_follows(follower_id);
CREATE INDEX idx_user_follows_following_id ON user_follows(following_id);
CREATE INDEX idx_user_follows_created_at ON user_follows(created_at);
CREATE INDEX idx_user_follows_follower_following ON user_follows(follower_id, following_id);

-- Add indexes for saved_posts table for better performance
CREATE INDEX IF NOT EXISTS idx_saved_posts_user_id ON saved_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_posts_post_id ON saved_posts(post_id);
CREATE INDEX IF NOT EXISTS idx_saved_posts_created_at ON saved_posts(created_at);
CREATE INDEX IF NOT EXISTS idx_saved_posts_user_post ON saved_posts(user_id, post_id);

-- Add indexes for other related tables that might benefit from performance improvements
CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON post_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_user_id ON post_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON post_comments(post_id);

-- Add comment for documentation
COMMENT ON TABLE user_follows IS 'Tracks user following relationships for the social features';
COMMENT ON INDEX idx_user_follows_follower_id IS 'Index for efficient queries by follower';
COMMENT ON INDEX idx_user_follows_following_id IS 'Index for efficient queries by following';
COMMENT ON INDEX idx_saved_posts_user_id IS 'Index for efficient queries by user';
COMMENT ON INDEX idx_saved_posts_post_id IS 'Index for efficient queries by post';
