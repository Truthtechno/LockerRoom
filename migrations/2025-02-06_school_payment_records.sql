-- Migration: Create school_payment_records table
-- Tracks all payment transactions for schools for audit trail
-- SAFE TO RUN: Uses IF NOT EXISTS

-- Create school_payment_records table
CREATE TABLE IF NOT EXISTS school_payment_records (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id VARCHAR NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  payment_amount DECIMAL(10, 2) NOT NULL,
  payment_frequency TEXT NOT NULL CHECK (payment_frequency IN ('monthly', 'annual')),
  payment_type TEXT NOT NULL CHECK (payment_type IN ('initial', 'renewal', 'student_limit_increase', 'student_limit_decrease', 'frequency_change')),
  student_limit_before INTEGER,
  student_limit_after INTEGER,
  old_frequency TEXT,
  new_frequency TEXT,
  notes TEXT,
  recorded_by VARCHAR REFERENCES users(id),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  subscription_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_school_payment_records_school_id ON school_payment_records(school_id);
CREATE INDEX IF NOT EXISTS idx_school_payment_records_recorded_at ON school_payment_records(recorded_at);
CREATE INDEX IF NOT EXISTS idx_school_payment_records_payment_type ON school_payment_records(payment_type);

-- Ensure all schools have valid max_students (set to 10 as per requirements)
UPDATE schools SET max_students = 10 WHERE max_students IS NULL OR max_students <= 0;

-- Add index for max_students if not exists
CREATE INDEX IF NOT EXISTS idx_schools_max_students ON schools(max_students);

-- Backfill payment records for existing schools with payment data
DO $$
DECLARE
    school_rec RECORD;
BEGIN
    FOR school_rec IN 
        SELECT id, payment_amount, payment_frequency, last_payment_date, subscription_expires_at, created_at
        FROM schools
        WHERE payment_amount IS NOT NULL AND payment_amount::DECIMAL > 0
    LOOP
        INSERT INTO school_payment_records (
            school_id,
            payment_amount,
            payment_frequency,
            payment_type,
            recorded_at,
            subscription_expires_at,
            notes
        )
        VALUES (
            school_rec.id,
            school_rec.payment_amount,
            COALESCE(school_rec.payment_frequency, 'monthly'),
            'initial',
            COALESCE(school_rec.last_payment_date, school_rec.created_at, NOW()),
            school_rec.subscription_expires_at,
            'Initial payment record (backfilled)'
        )
        ON CONFLICT DO NOTHING;
    END LOOP;
END $$;

