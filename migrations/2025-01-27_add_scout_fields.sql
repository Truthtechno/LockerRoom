-- Add new fields to users table for scout functionality
ALTER TABLE users 
ADD COLUMN xen_id TEXT,
ADD COLUMN otp TEXT,
ADD COLUMN profile_pic_url TEXT;

-- Add unique constraint for xen_id
ALTER TABLE users 
ADD CONSTRAINT users_xen_id_unique UNIQUE (xen_id);

-- Update role enum to include new roles
-- Note: PostgreSQL doesn't have enum types in this schema, so we just update the comment
COMMENT ON COLUMN users.role IS 'system_admin, school_admin, student, viewer, scout_admin, xen_scout, super_admin, moderator';
