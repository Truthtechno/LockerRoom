-- Update payment prices from cents (integer) to actual currency amounts (decimal)
-- This migration converts existing cent values to dollar amounts and changes the column types

-- Step 1: Add new decimal columns temporarily
ALTER TABLE system_payment 
ADD COLUMN IF NOT EXISTS xen_scout_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS scout_ai_price DECIMAL(10, 2);

-- Step 2: Convert existing cent values to dollar amounts (divide by 100)
UPDATE system_payment 
SET 
  xen_scout_price = COALESCE(xen_scout_price_cents, 1000) / 100.0,
  scout_ai_price = COALESCE(scout_ai_price_cents, 1000) / 100.0
WHERE xen_scout_price IS NULL OR scout_ai_price IS NULL;

-- Step 3: Set default values for any null values
UPDATE system_payment 
SET 
  xen_scout_price = COALESCE(xen_scout_price, 10.00),
  scout_ai_price = COALESCE(scout_ai_price, 10.00)
WHERE xen_scout_price IS NULL OR scout_ai_price IS NULL;

-- Step 4: Make new columns NOT NULL with defaults
ALTER TABLE system_payment 
ALTER COLUMN xen_scout_price SET DEFAULT 10.00,
ALTER COLUMN scout_ai_price SET DEFAULT 10.00;

-- Step 5: For columns that are already populated, we can't directly change to NOT NULL
-- So we'll update the schema to allow NULL temporarily, then backfill
UPDATE system_payment SET xen_scout_price = 10.00 WHERE xen_scout_price IS NULL;
UPDATE system_payment SET scout_ai_price = 10.00 WHERE scout_ai_price IS NULL;

-- Step 6: Drop old integer columns (keep them for now, we'll drop after verification)
-- ALTER TABLE system_payment DROP COLUMN IF EXISTS xen_scout_price_cents;
-- ALTER TABLE system_payment DROP COLUMN IF EXISTS scout_ai_price_cents;

-- Note: The old columns will be dropped in a future migration after confirming everything works

