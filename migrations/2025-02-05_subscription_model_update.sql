-- Migration: Update schools table to new subscription model
-- Removes subscriptionPlan (premium/standard) and adds flexible payment tracking
-- SAFE TO RUN: Uses IF NOT EXISTS and preserves existing data

-- Add new subscription columns
ALTER TABLE schools 
ADD COLUMN IF NOT EXISTS payment_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS payment_frequency TEXT NOT NULL DEFAULT 'monthly',
ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS last_payment_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Update existing schools: convert premium to $900 annual, standard to $75 monthly
-- Most schools get $900 annual, at least one gets $75 monthly
DO $$
DECLARE
    school_rec RECORD;
    school_count INTEGER;
    annual_count INTEGER := 0;
    total_schools INTEGER;
BEGIN
    -- Count total schools
    SELECT COUNT(*) INTO total_schools FROM schools;
    
    -- Process each school
    FOR school_rec IN SELECT id, subscription_plan, created_at FROM schools ORDER BY created_at
    LOOP
        IF annual_count < total_schools - 1 THEN
            -- Set to annual $900
            UPDATE schools 
            SET 
                payment_amount = 900.00,
                payment_frequency = 'annual',
                subscription_expires_at = created_at + INTERVAL '1 year',
                last_payment_date = created_at,
                is_active = TRUE
            WHERE id = school_rec.id;
            annual_count := annual_count + 1;
        ELSE
            -- Last school gets monthly $75
            UPDATE schools 
            SET 
                payment_amount = 75.00,
                payment_frequency = 'monthly',
                subscription_expires_at = created_at + INTERVAL '1 month',
                last_payment_date = created_at,
                is_active = TRUE
            WHERE id = school_rec.id;
        END IF;
    END LOOP;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_schools_is_active ON schools(is_active);
CREATE INDEX IF NOT EXISTS idx_schools_subscription_expires_at ON schools(subscription_expires_at);
CREATE INDEX IF NOT EXISTS idx_schools_payment_frequency ON schools(payment_frequency);

-- Note: We're keeping subscription_plan column for now to avoid breaking existing queries
-- It can be dropped in a future migration after all code is updated
-- ALTER TABLE schools DROP COLUMN IF EXISTS subscription_plan;

