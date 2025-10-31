-- System Configuration Tables
-- Stores branding, appearance, and payment settings

-- Branding configuration
CREATE TABLE IF NOT EXISTS system_branding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'LockerRoom',
  logo_url TEXT,
  favicon_url TEXT,
  company_name TEXT,
  company_address TEXT,
  company_city TEXT,
  company_state TEXT,
  company_zip TEXT,
  company_country TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  website_url TEXT,
  social_facebook TEXT,
  social_twitter TEXT,
  social_instagram TEXT,
  social_linkedin TEXT,
  updated_by VARCHAR(255) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(id)
);

-- Appearance/Theming configuration
CREATE TABLE IF NOT EXISTS system_appearance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_mode TEXT NOT NULL DEFAULT 'auto', -- auto, light, dark
  light_mode_primary_color TEXT NOT NULL DEFAULT '#FFD700',
  light_mode_secondary_color TEXT NOT NULL DEFAULT '#000000',
  light_mode_accent_color TEXT NOT NULL DEFAULT '#FFFFFF',
  light_mode_background TEXT NOT NULL DEFAULT '#FFFFFF',
  light_mode_foreground TEXT NOT NULL DEFAULT '#0A0A0A',
  light_mode_muted TEXT NOT NULL DEFAULT '#F4F4F5',
  light_mode_border TEXT NOT NULL DEFAULT '#E4E4E7',
  dark_mode_primary_color TEXT NOT NULL DEFAULT '#FFD700',
  dark_mode_secondary_color TEXT NOT NULL DEFAULT '#FFFFFF',
  dark_mode_accent_color TEXT NOT NULL DEFAULT '#000000',
  dark_mode_background TEXT NOT NULL DEFAULT '#0A0A0A',
  dark_mode_foreground TEXT NOT NULL DEFAULT '#FAFAFA',
  dark_mode_muted TEXT NOT NULL DEFAULT '#27272A',
  dark_mode_border TEXT NOT NULL DEFAULT '#3F3F46',
  font_family TEXT DEFAULT 'Inter',
  font_size_base TEXT DEFAULT '1rem',
  updated_by VARCHAR(255) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(id)
);

-- Payment configuration
CREATE TABLE IF NOT EXISTS system_payment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mock_mode_enabled BOOLEAN NOT NULL DEFAULT true,
  provider TEXT NOT NULL DEFAULT 'none', -- stripe, paypal, none
  -- Stripe configuration
  stripe_publishable_key TEXT,
  stripe_secret_key_encrypted TEXT,
  stripe_webhook_secret_encrypted TEXT,
  -- PayPal configuration
  paypal_client_id TEXT,
  paypal_client_secret_encrypted TEXT,
  paypal_mode TEXT DEFAULT 'sandbox', -- sandbox, live
  -- General payment settings
  currency TEXT NOT NULL DEFAULT 'USD',
  xen_scout_price_cents INTEGER NOT NULL DEFAULT 1000, -- $10.00 in cents
  enable_subscriptions BOOLEAN NOT NULL DEFAULT false,
  subscription_monthly_price_cents INTEGER DEFAULT 0,
  subscription_yearly_price_cents INTEGER DEFAULT 0,
  updated_by VARCHAR(255) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(id)
);

-- Insert default branding config
INSERT INTO system_branding (name, contact_email, updated_by)
VALUES ('LockerRoom', 'admin@lockerroom.com', 'system')
ON CONFLICT DO NOTHING;

-- Insert default appearance config
INSERT INTO system_appearance (updated_by)
VALUES ('system')
ON CONFLICT DO NOTHING;

-- Insert default payment config
INSERT INTO system_payment (mock_mode_enabled, provider, updated_by)
VALUES (true, 'none', 'system')
ON CONFLICT DO NOTHING;

