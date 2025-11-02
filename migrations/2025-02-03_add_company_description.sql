-- Add company_description field to system_branding table
ALTER TABLE system_branding 
ADD COLUMN IF NOT EXISTS company_description TEXT;

