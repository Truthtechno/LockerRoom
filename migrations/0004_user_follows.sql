-- Migration: Add user_follows table for follow/unfollow functionality
-- Created: 2024-01-XX
-- Description: Creates user_follows table to track user following relationships

CREATE TABLE user_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(follower_id, following_id)
);

-- Create indexes for better query performance
CREATE INDEX idx_user_follows_follower_id ON user_follows(follower_id);
CREATE INDEX idx_user_follows_following_id ON user_follows(following_id);
CREATE INDEX idx_user_follows_created_at ON user_follows(created_at);

-- Add comment for documentation
COMMENT ON TABLE user_follows IS 'Tracks user following relationships for the social features';
