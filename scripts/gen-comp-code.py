#!/usr/bin/env python3
"""
Generate LuminaDeck comp/promo codes and insert them into Supabase.

Usage:
    # Single lifetime code with a label
    python scripts/gen-comp-code.py --tier lifetime --note "Founder lifetime"

    # 50 reviewer codes, each redeemable once, expiring in 90 days
    python scripts/gen-comp-code.py --tier lifetime --count 50 \
        --note "App reviewer batch 2026-Q2" --expires-days 90

    # One code redeemable up to 3 times (small team comp)
    python scripts/gen-comp-code.py --tier lifetime --max-redemptions 3 \
        --note "@somecreator influencer"

Required env (read from C:/Dev/LuminaDeck/.env or your shell):
    SUPABASE_URL                 — project URL, e.g. https://xxxxx.supabase.co
    SUPABASE_SERVICE_ROLE_KEY    — service role secret (NOT the anon key)

Codes look like:  LUMI-A8FK-2X9P  (4-4-4 alphanumeric, ~64 bits of entropy)
The hyphens are display-only — the redeem flow accepts both forms.
"""
from __future__ import annotations

import argparse
import json
import os
import secrets
import string
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib import request, error

# 32-char alphabet with confusing letters (O/0, I/1, etc.) removed
ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
PREFIX = "LUMI"
CODE_GROUPS = 3  # 4-4-4 after prefix → LUMI-XXXX-XXXX-XXXX
GROUP_LEN = 4

VALID_TIERS = ("lifetime", "pro_1y", "pro_30d")


def generate_code() -> str:
    groups = [
        "".join(secrets.choice(ALPHABET) for _ in range(GROUP_LEN))
        for _ in range(CODE_GROUPS)
    ]
    return f"{PREFIX}-{'-'.join(groups)}"


def load_env_file(path: Path) -> dict:
    if not path.is_file():
        return {}
    out = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def insert_code(
    *, supabase_url: str, service_key: str, code: str, tier: str,
    max_redemptions: int, expires_at: str | None, note: str | None, created_by: str,
) -> tuple[bool, str]:
    body = json.dumps({
        "code": code,
        "tier": tier,
        "max_redemptions": max_redemptions,
        "expires_at": expires_at,
        "note": note,
        "created_by": created_by,
    }).encode("utf-8")

    req = request.Request(
        f"{supabase_url}/rest/v1/luminadeck_comp_codes",
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Prefer": "return=representation",
        },
    )
    try:
        with request.urlopen(req, timeout=15) as resp:
            return True, resp.read().decode("utf-8")
    except error.HTTPError as e:
        return False, f"HTTP {e.code}: {e.read().decode('utf-8', errors='replace')}"
    except error.URLError as e:
        return False, f"network: {e.reason}"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--tier", choices=VALID_TIERS, required=True)
    parser.add_argument("--count", type=int, default=1, help="how many distinct codes to mint (default 1)")
    parser.add_argument("--max-redemptions", type=int, default=1, help="redemptions per code (default 1)")
    parser.add_argument("--expires-days", type=int, default=None, help="optional code expiry in days from now")
    parser.add_argument("--note", default=None, help="admin label, e.g. 'Founder lifetime'")
    parser.add_argument("--created-by", default=os.environ.get("USER") or os.environ.get("USERNAME") or "cli")
    parser.add_argument("--dry-run", action="store_true", help="generate codes but do NOT insert into Supabase")
    args = parser.parse_args()

    if args.count < 1 or args.max_redemptions < 1:
        print("count and max-redemptions must be positive", file=sys.stderr)
        return 2

    expires_at: str | None = None
    if args.expires_days is not None:
        expires_at = (datetime.now(timezone.utc) + timedelta(days=args.expires_days)).isoformat()

    repo_root = Path(__file__).resolve().parent.parent
    env = {**load_env_file(repo_root / ".env"), **os.environ}
    supabase_url = env.get("SUPABASE_URL", "").rstrip("/")
    service_key = env.get("SUPABASE_SERVICE_ROLE_KEY", "")

    if not args.dry_run and (not supabase_url or not service_key):
        print(
            "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set them in .env "
            "or your shell, or use --dry-run to just print codes.",
            file=sys.stderr,
        )
        return 2

    minted: list[str] = []
    for i in range(args.count):
        code = generate_code()
        if args.dry_run:
            minted.append(code)
            continue

        ok, info = insert_code(
            supabase_url=supabase_url,
            service_key=service_key,
            code=code,
            tier=args.tier,
            max_redemptions=args.max_redemptions,
            expires_at=expires_at,
            note=args.note,
            created_by=args.created_by,
        )
        if not ok:
            print(f"FAIL  {code}  → {info}", file=sys.stderr)
            return 1
        minted.append(code)

    print()
    print(f"  Tier:            {args.tier}")
    print(f"  Max redemptions: {args.max_redemptions}")
    if expires_at:
        print(f"  Expires:         {expires_at}")
    if args.note:
        print(f"  Note:            {args.note}")
    if args.dry_run:
        print("  (DRY RUN — not written to Supabase)")
    print()
    print("Code(s):")
    for code in minted:
        print(f"  {code}")
    print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
