-- LuminaDeck comp/promo code redemption system
-- Lets the team grant Pro/Lifetime access to specific devices without going
-- through Apple/Google IAP. Used for: dev/test devices, app reviewers,
-- influencers, support comps, and the founder's own daily-driver phone.
--
-- Design notes:
--   - Codes are anonymous (no auth required) so first-launch redemption works
--     before the user has a Supabase auth session
--   - Per-device redemption tracking prevents one code from being redeemed
--     unlimited times across many devices
--   - Codes can be single-use (max_redemptions=1) or batch (e.g. 50 reviewer
--     codes sharing a single string is NOT supported — each batch member
--     gets its own row; use the gen-comp-code.py CLI to bulk-create)

-- ============================================================
-- Comp codes
-- ============================================================

CREATE TABLE IF NOT EXISTS luminadeck_comp_codes (
  code            TEXT PRIMARY KEY,
  tier            TEXT NOT NULL CHECK (tier IN ('lifetime', 'pro_1y', 'pro_30d')),
  max_redemptions INTEGER NOT NULL DEFAULT 1 CHECK (max_redemptions > 0),
  redemptions_used INTEGER NOT NULL DEFAULT 0,
  expires_at      TIMESTAMPTZ,                -- NULL = never expires (the code itself, not the granted entitlement)
  note            TEXT,                       -- admin label e.g. "Founder lifetime", "Reviewer 2026-Q2 batch", "@user influencer"
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  created_by      TEXT,                       -- free-form admin attribution
  CONSTRAINT redemption_cap CHECK (redemptions_used <= max_redemptions)
);

-- Code lookups by case-insensitive match (we store/normalize uppercase in the
-- edge function, but this protects against accidental lowercase inserts)
CREATE INDEX IF NOT EXISTS idx_luminadeck_comp_codes_upper
  ON luminadeck_comp_codes (UPPER(code));

-- ============================================================
-- Redemption ledger
-- ============================================================

CREATE TABLE IF NOT EXISTS luminadeck_comp_redemptions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code        TEXT NOT NULL REFERENCES luminadeck_comp_codes(code) ON DELETE RESTRICT,
  device_id   TEXT NOT NULL,                  -- the mobile app's persistent deviceId
  user_id     UUID REFERENCES luminadeck_users(id) ON DELETE SET NULL,
  platform    TEXT CHECK (platform IN ('ios', 'android', 'windows')),
  app_version TEXT,
  redeemed_at TIMESTAMPTZ DEFAULT NOW()
);

-- One device can redeem one code at most once (idempotency for retries)
CREATE UNIQUE INDEX IF NOT EXISTS uq_luminadeck_comp_redemptions_device_code
  ON luminadeck_comp_redemptions (code, device_id);

CREATE INDEX IF NOT EXISTS idx_luminadeck_comp_redemptions_device
  ON luminadeck_comp_redemptions (device_id);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE luminadeck_comp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE luminadeck_comp_redemptions ENABLE ROW LEVEL SECURITY;

-- No client-side reads of either table — all access goes through the
-- redeem-code edge function with the service role key. The lack of any
-- SELECT/INSERT policies means anon and authenticated requests both fail
-- closed, which is what we want.

-- ============================================================
-- Helper view: code utilization (admin convenience)
-- ============================================================

CREATE OR REPLACE VIEW luminadeck_comp_code_status AS
SELECT
  c.code,
  c.tier,
  c.max_redemptions,
  c.redemptions_used,
  c.max_redemptions - c.redemptions_used AS remaining,
  c.expires_at,
  c.note,
  c.created_at,
  c.created_by
FROM luminadeck_comp_codes c;
