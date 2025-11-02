-- Payment System Updates Migration
-- Adds ScoutAI pricing and payment transactions table

-- Add scout_ai_price_cents column to system_payment table
ALTER TABLE system_payment 
ADD COLUMN IF NOT EXISTS scout_ai_price_cents INTEGER NOT NULL DEFAULT 1000;

-- Create payment_transactions table
CREATE TABLE IF NOT EXISTS payment_transactions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('xen_watch', 'scout_ai')),
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  provider TEXT NOT NULL DEFAULT 'mock' CHECK (provider IN ('mock', 'stripe', 'paypal')),
  provider_transaction_id TEXT,
  metadata TEXT, -- JSON string with additional data
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(id)
);

-- Create indexes for payment transactions
CREATE INDEX IF NOT EXISTS payment_transactions_user_id_idx ON payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS payment_transactions_type_idx ON payment_transactions(type);
CREATE INDEX IF NOT EXISTS payment_transactions_status_idx ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS payment_transactions_created_at_idx ON payment_transactions(created_at);

-- Update existing payment config if it doesn't have scout_ai_price_cents
UPDATE system_payment 
SET scout_ai_price_cents = 1000 
WHERE scout_ai_price_cents IS NULL;

