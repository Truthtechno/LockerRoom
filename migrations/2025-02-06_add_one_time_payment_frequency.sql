-- Migration: Add 'one-time' payment frequency option
-- Updates CHECK constraints to allow 'one-time' payments

-- Update school_payment_records table constraint
ALTER TABLE school_payment_records 
DROP CONSTRAINT IF EXISTS school_payment_records_payment_frequency_check;

ALTER TABLE school_payment_records
ADD CONSTRAINT school_payment_records_payment_frequency_check 
CHECK (payment_frequency IN ('monthly', 'annual', 'one-time'));

-- Note: The schools table payment_frequency field doesn't have a CHECK constraint
-- so it will automatically accept 'one-time' values

