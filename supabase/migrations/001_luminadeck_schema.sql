-- LuminaDeck schema - namespaced with luminadeck_ prefix
-- Designed to live inside an existing Supabase project (adlai)
-- Migration-ready: when moving to own project, rename tables by removing prefix

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Users / Pro Licensing
-- ============================================================

CREATE TABLE IF NOT EXISTS luminadeck_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id UUID UNIQUE NOT NULL, -- References auth.users(id)
  email TEXT,
  is_pro BOOLEAN DEFAULT FALSE,
  pro_purchased_at TIMESTAMPTZ,
  pro_source TEXT CHECK (pro_source IN ('apple_iap', 'stripe', 'manual')),
  apple_receipt_data TEXT, -- Latest validated receipt
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast auth lookups
CREATE INDEX IF NOT EXISTS idx_luminadeck_users_auth_id ON luminadeck_users(auth_id);

-- ============================================================
-- Feature Flags (server-side kill switches)
-- ============================================================

CREATE TABLE IF NOT EXISTS luminadeck_feature_flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  flag_key TEXT UNIQUE NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default flags
INSERT INTO luminadeck_feature_flags (flag_key, enabled, description) VALUES
  ('pro_purchases_enabled', TRUE, 'Master switch for Pro IAP purchases'),
  ('multi_action_enabled', TRUE, 'Enable multi-action sequences for Pro users'),
  ('custom_images_enabled', TRUE, 'Enable custom image upload for Pro users'),
  ('profile_export_enabled', TRUE, 'Enable profile import/export for Pro users')
ON CONFLICT (flag_key) DO NOTHING;

-- ============================================================
-- Apple Receipt Validation Log
-- ============================================================

CREATE TABLE IF NOT EXISTS luminadeck_receipt_validations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES luminadeck_users(id),
  receipt_hash TEXT NOT NULL, -- SHA-256 of receipt data (no raw receipt stored)
  product_id TEXT NOT NULL,
  is_valid BOOLEAN NOT NULL,
  validation_source TEXT CHECK (validation_source IN ('apple_storekit2', 'apple_legacy')),
  environment TEXT CHECK (environment IN ('production', 'sandbox')),
  validated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_luminadeck_receipts_user ON luminadeck_receipt_validations(user_id);

-- ============================================================
-- Analytics (basic, privacy-respecting)
-- ============================================================

CREATE TABLE IF NOT EXISTS luminadeck_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type TEXT NOT NULL,
  -- Anonymized: no user ID, no device ID, no IP
  app_version TEXT,
  platform TEXT CHECK (platform IN ('ios', 'windows')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partition-friendly index for time-based queries
CREATE INDEX IF NOT EXISTS idx_luminadeck_events_created ON luminadeck_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_luminadeck_events_type ON luminadeck_events(event_type);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE luminadeck_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE luminadeck_feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE luminadeck_receipt_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE luminadeck_events ENABLE ROW LEVEL SECURITY;

-- Users can only read their own row
CREATE POLICY luminadeck_users_select ON luminadeck_users
  FOR SELECT USING (auth_id = auth.uid());

CREATE POLICY luminadeck_users_update ON luminadeck_users
  FOR UPDATE USING (auth_id = auth.uid());

-- Feature flags are readable by anyone (public config)
CREATE POLICY luminadeck_flags_select ON luminadeck_feature_flags
  FOR SELECT USING (TRUE);

-- Receipt validations only visible to the user who owns them
CREATE POLICY luminadeck_receipts_select ON luminadeck_receipt_validations
  FOR SELECT USING (
    user_id IN (SELECT id FROM luminadeck_users WHERE auth_id = auth.uid())
  );

-- Events are insert-only for authenticated users, no read
CREATE POLICY luminadeck_events_insert ON luminadeck_events
  FOR INSERT WITH CHECK (TRUE);

-- ============================================================
-- Updated_at trigger
-- ============================================================

CREATE OR REPLACE FUNCTION luminadeck_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER luminadeck_users_updated
  BEFORE UPDATE ON luminadeck_users
  FOR EACH ROW EXECUTE FUNCTION luminadeck_update_timestamp();

CREATE TRIGGER luminadeck_flags_updated
  BEFORE UPDATE ON luminadeck_feature_flags
  FOR EACH ROW EXECUTE FUNCTION luminadeck_update_timestamp();

-- ============================================================
-- Migration notes
-- ============================================================
-- To migrate to standalone project:
-- 1. pg_dump these tables (WHERE table_name LIKE 'luminadeck_%')
-- 2. In new project, rename tables: s/luminadeck_//g
-- 3. Update RLS policies to remove luminadeck_ prefix
-- 4. Update edge functions to use new table names
