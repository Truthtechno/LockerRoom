-- Add company_logo_url field to system_branding table
-- This is separate from logo_url (platform/app logo)
ALTER TABLE system_branding 
ADD COLUMN IF NOT EXISTS company_logo_url TEXT;

