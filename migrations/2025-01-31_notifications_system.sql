-- Notifications System Migration
-- Creates notifications table for role-based notification system

CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  entity_type VARCHAR, -- post, user, submission, announcement, etc.
  entity_id VARCHAR, -- ID of the related entity
  related_user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL, -- User who triggered the notification
  metadata JSONB, -- Additional data in JSON format
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_entity ON notifications(entity_type, entity_id);

-- Add comment for documentation
COMMENT ON TABLE notifications IS 'Role-based notification system for all user types';
COMMENT ON COLUMN notifications.type IS 'Notification type: post_like, post_comment, new_follower, announcement, scout_feedback, submission_pending, etc.';
COMMENT ON COLUMN notifications.entity_type IS 'Type of entity this notification relates to: post, user, submission, announcement';
COMMENT ON COLUMN notifications.entity_id IS 'ID of the related entity';
COMMENT ON COLUMN notifications.metadata IS 'Additional JSON data for the notification';

