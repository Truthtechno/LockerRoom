-- Email Authentication System Migration
-- Adds fields for email verification, password reset, and OTP management

-- Add email verification fields
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email_verification_token TEXT,
ADD COLUMN IF NOT EXISTS email_verification_token_expires_at TIMESTAMP;

-- Add password reset fields
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS password_reset_token TEXT,
ADD COLUMN IF NOT EXISTS password_reset_token_expires_at TIMESTAMP;

-- Add OTP fields (separate from password)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS otp_hash TEXT,
ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMP;

-- Add email rate limiting field
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS last_email_sent_at TIMESTAMP;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email_verification_token ON users(email_verification_token);
CREATE INDEX IF NOT EXISTS idx_users_password_reset_token ON users(password_reset_token);
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified);
CREATE INDEX IF NOT EXISTS idx_users_otp_hash ON users(otp_hash) WHERE otp_hash IS NOT NULL;

