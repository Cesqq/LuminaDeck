-- LuminaDeck atomic comp-code redemption
--
-- Closes a redemption race: the edge function previously checked
-- `redemptions_used >= max_redemptions` and THEN inserted, so two concurrent
-- requests from different devices could both read used=0 (cap not hit), both
-- pass the check, and both insert — over-granting a limited-use code. The
-- unique index on (code, device_id) only stops the SAME device redeeming
-- twice; it does nothing for two DIFFERENT devices racing the cap.
--
-- This function performs lookup, cap enforcement, insert, and counter bump in
-- a single transaction. `SELECT ... FOR UPDATE` takes a row lock on the code,
-- so concurrent redemptions of the same code are serialized: each one sees the
-- counter the previous one committed, and only (max_redemptions) of them can
-- ever succeed.
--
-- Returns a single row describing the outcome. The edge function maps the
-- `result` enum onto its existing JSON contract.

CREATE OR REPLACE FUNCTION redeem_comp_code(
  p_code        TEXT,
  p_device_id   TEXT,
  p_platform    TEXT DEFAULT NULL,
  p_app_version TEXT DEFAULT NULL
)
RETURNS TABLE (
  result      TEXT,    -- 'redeemed' | 'already_redeemed' | 'not_found' | 'expired' | 'exhausted'
  tier        TEXT,
  redeemed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
-- Pin search_path so an attacker cannot shadow our table/function names by
-- creating objects in another schema on the session search_path.
SET search_path = public, pg_temp
AS $$
DECLARE
  v_code_row luminadeck_comp_codes%ROWTYPE;
  v_prior    luminadeck_comp_redemptions%ROWTYPE;
BEGIN
  -- Lock the code row for the duration of this transaction. Concurrent
  -- redemptions of the same code block here and resume one at a time, so each
  -- sees the redemptions_used value the prior winner committed.
  SELECT * INTO v_code_row
  FROM luminadeck_comp_codes
  WHERE code = p_code
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::TEXT, NULL::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  -- Idempotency: this device already redeemed this code. Return success with
  -- the original redemption time so the client gets a stable expiry.
  SELECT * INTO v_prior
  FROM luminadeck_comp_redemptions
  WHERE code = v_code_row.code AND device_id = p_device_id;

  IF FOUND THEN
    RETURN QUERY SELECT 'already_redeemed'::TEXT, v_code_row.tier, v_prior.redeemed_at;
    RETURN;
  END IF;

  IF v_code_row.expires_at IS NOT NULL AND v_code_row.expires_at < NOW() THEN
    RETURN QUERY SELECT 'expired'::TEXT, v_code_row.tier, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  -- Cap check under the row lock — this is the atomic guard. Because the row
  -- is locked, no other transaction can have inserted a redemption + bumped
  -- the counter between this read and our update below.
  IF v_code_row.redemptions_used >= v_code_row.max_redemptions THEN
    RETURN QUERY SELECT 'exhausted'::TEXT, v_code_row.tier, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  INSERT INTO luminadeck_comp_redemptions (code, device_id, platform, app_version)
  VALUES (v_code_row.code, p_device_id, p_platform, p_app_version);

  UPDATE luminadeck_comp_codes
  SET redemptions_used = redemptions_used + 1
  WHERE code = v_code_row.code;

  RETURN QUERY SELECT 'redeemed'::TEXT, v_code_row.tier, NOW();
END;
$$;

-- Only the service role (used by the edge function) may call this. anon /
-- authenticated clients have no direct path to the comp-code tables.
REVOKE ALL ON FUNCTION redeem_comp_code(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION redeem_comp_code(TEXT, TEXT, TEXT, TEXT) TO service_role;
