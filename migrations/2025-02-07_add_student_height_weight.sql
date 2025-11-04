-- Migration: Add height and weight fields to students table
-- SAFE TO RUN: Uses IF NOT EXISTS

-- Add height column (stored in cm as text)
ALTER TABLE students 
ADD COLUMN IF NOT EXISTS height TEXT;

-- Add weight column (stored in kg as text)
ALTER TABLE students 
ADD COLUMN IF NOT EXISTS weight TEXT;

-- Add comments for documentation
COMMENT ON COLUMN students.height IS 'Height in centimeters (stored as text)';
COMMENT ON COLUMN students.weight IS 'Weight in kilograms (stored as text)';

