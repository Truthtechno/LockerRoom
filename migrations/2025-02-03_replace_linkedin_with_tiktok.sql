-- Replace LinkedIn with TikTok in system_branding table
-- First, add the new TikTok column
ALTER TABLE system_branding 
ADD COLUMN IF NOT EXISTS social_tiktok TEXT;

-- Copy any existing LinkedIn data to TikTok (optional - comment out if you want to start fresh)
-- UPDATE system_branding SET social_tiktok = social_linkedin WHERE social_linkedin IS NOT NULL;

-- Drop the old LinkedIn column
ALTER TABLE system_branding 
DROP COLUMN IF EXISTS social_linkedin;

