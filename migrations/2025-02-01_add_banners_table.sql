-- Add banners table for dashboard-level communications
-- This migration creates a new table for system admin banners that appear on role-specific dashboards

CREATE TABLE IF NOT EXISTS banners (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('info', 'warning', 'success', 'error', 'announcement')),
  target_roles TEXT[] NOT NULL DEFAULT '{}',
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  created_by_admin_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT now() NOT NULL,
  updated_at TIMESTAMP DEFAULT now() NOT NULL
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_banners_target_roles ON banners USING GIN(target_roles);
CREATE INDEX IF NOT EXISTS idx_banners_is_active ON banners(is_active);
CREATE INDEX IF NOT EXISTS idx_banners_dates ON banners(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_banners_priority ON banners(priority DESC);
CREATE INDEX IF NOT EXISTS idx_banners_created_by ON banners(created_by_admin_id);

-- Add comment for documentation
COMMENT ON TABLE banners IS 'Dashboard-level banners for role-specific communications (scouts, school admins, scout admins)';
COMMENT ON COLUMN banners.category IS 'Color category: info (blue), warning (yellow), success (green), error (red), announcement (purple)';
COMMENT ON COLUMN banners.target_roles IS 'Array of user roles that should see this banner: scout_admin, school_admin, xen_scout';
COMMENT ON COLUMN banners.priority IS 'Higher priority banners are displayed first';

