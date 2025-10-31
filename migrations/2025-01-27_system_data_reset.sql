-- Migration: System Data Reset (Preserve System Admins)
-- Description: Safely deletes all records except system_admin users
-- Date: 2025-01-27
-- Author: System Dev

-- This migration performs a complete system reset while preserving system admin accounts
-- It deletes all schools, students, posts, and related data in the correct order
-- to maintain referential integrity

BEGIN;

-- Log the reset operation
INSERT INTO analytics_logs (event_type, entity_type, metadata, timestamp)
VALUES (
  'system_reset',
  'system',
  '{"reason": "Data integrity reset", "preserved_system_admins": true}',
  NOW()
);

-- Step 1: Delete all content and engagement data first (no foreign key dependencies)
DELETE FROM post_views;
DELETE FROM saved_posts;
DELETE FROM reported_posts;
DELETE FROM post_likes;
DELETE FROM post_comments;
DELETE FROM posts;

-- Step 2: Delete XEN Watch related data
DELETE FROM submission_final_feedback;
DELETE FROM submission_reviews;
DELETE FROM submissions;
DELETE FROM xen_watch_feedback;
DELETE FROM xen_watch_reviews;
DELETE FROM xen_watch_submissions;
DELETE FROM scout_profiles;

-- Step 3: Delete user relationships and follows
DELETE FROM user_follows;
DELETE FROM student_followers;

-- Step 4: Delete student ratings and settings
DELETE FROM student_ratings;
DELETE FROM school_settings;

-- Step 5: Delete students (references users and schools)
DELETE FROM students;

-- Step 6: Delete school admins (references schools)
DELETE FROM school_admins;

-- Step 7: Delete subscriptions (references schools)
DELETE FROM subscriptions;

-- Step 8: Delete school applications
DELETE FROM school_applications;

-- Step 9: Delete schools
DELETE FROM schools;

-- Step 10: Delete viewers (no foreign key dependencies)
DELETE FROM viewers;

-- Step 11: Delete system admins (but preserve their user accounts)
DELETE FROM system_admins;

-- Step 12: Delete admin roles
DELETE FROM admin_roles;

-- Step 13: Delete admins table entries (separate from users)
DELETE FROM admins;

-- Step 14: Delete users EXCEPT those with role = 'system_admin'
-- This preserves system admin accounts with their credentials intact
DELETE FROM users 
WHERE role != 'system_admin';

-- Step 15: Reset system settings to defaults (optional - comment out if you want to keep settings)
-- DELETE FROM system_settings;

-- Log completion
INSERT INTO analytics_logs (event_type, entity_type, metadata, timestamp)
VALUES (
  'system_reset_complete',
  'system',
  '{"status": "success", "preserved_system_admins": true, "tables_cleared": ["schools", "students", "posts", "school_admins", "viewers", "subscriptions", "school_applications", "system_admins", "admin_roles", "admins", "users_except_system_admin"]}',
  NOW()
);

COMMIT;

-- Verification queries (run these after migration to confirm reset)
-- SELECT COUNT(*) as system_admin_count FROM users WHERE role = 'system_admin';
-- SELECT COUNT(*) as total_users FROM users;
-- SELECT COUNT(*) as schools_count FROM schools;
-- SELECT COUNT(*) as students_count FROM students;
-- SELECT COUNT(*) as posts_count FROM posts;
