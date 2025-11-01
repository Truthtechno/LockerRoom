-- Add target_school_ids column to banners table for school-specific targeting
-- This allows banners to be targeted to specific schools when school_admin role is selected

ALTER TABLE banners ADD COLUMN IF NOT EXISTS target_school_ids TEXT[] DEFAULT NULL;

-- Add index for performance when filtering by school IDs
CREATE INDEX IF NOT EXISTS idx_banners_target_school_ids ON banners USING GIN(target_school_ids);

-- Add comment for documentation
COMMENT ON COLUMN banners.target_school_ids IS 'Array of school IDs that should see this banner (only applies when school_admin is in target_roles). NULL means all schools.';

