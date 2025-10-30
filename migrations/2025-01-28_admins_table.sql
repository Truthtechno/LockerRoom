-- Create admins table as main source of truth for admin authentication/roles
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL,
  profile_pic_url TEXT,
  xen_id TEXT,
  otp TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for efficient role-based queries
CREATE INDEX IF NOT EXISTS idx_admins_role ON admins(role);
CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);
CREATE INDEX IF NOT EXISTS idx_admins_xen_id ON admins(xen_id) WHERE xen_id IS NOT NULL;

-- Ensure scout_profiles table exists with proper structure
CREATE TABLE IF NOT EXISTS scout_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  xen_id TEXT UNIQUE NOT NULL,
  otp TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for scout_profiles
CREATE INDEX IF NOT EXISTS idx_scout_profiles_admin_id ON scout_profiles(admin_id);
CREATE INDEX IF NOT EXISTS idx_scout_profiles_xen_id ON scout_profiles(xen_id);

-- Add comment to clarify the relationship
COMMENT ON TABLE admins IS 'Main source of truth for admin authentication and roles';
COMMENT ON TABLE scout_profiles IS 'Optional scout-specific data linked to admins table';
