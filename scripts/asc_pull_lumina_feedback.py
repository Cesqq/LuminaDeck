#!/usr/bin/env python3
"""Pull TestFlight beta feedback (screenshots + crashes) for Lumina Deck
via the App Store Connect REST API. Mirrors the canonical pattern from
~/.claude/CLAUDE.md but hardcoded to our App ID + key so it runs in
one shot from the Mac.

Output: JSON dump to stdout, plus pretty-printed crash + screenshot
summaries. Crash logs and screenshot URLs are CDN signed-asset URLs
(no auth on the CDN), printed inline.
"""

from __future__ import annotations
import json
import sys
import time
from pathlib import Path

import jwt  # PyJWT
import requests

KEY_ID = "5G4BLJ82KH"
ISSUER_ID = "b9dc67a7-763a-4031-aa71-ada7964eddd5"
KEY_PATH = Path.home() / ".keys" / f"AuthKey_{KEY_ID}.p8"
APP_ID = "6762442797"  # LuminaDeck (com.luminadeck.app)
API = "https://api.appstoreconnect.apple.com"
SINCE_HOURS = 168  # last 7 days


def make_token() -> str:
    pkey = KEY_PATH.read_text()
    now = int(time.time())
    return jwt.encode(
        {"iss": ISSUER_ID, "iat": now, "exp": now + 19 * 60, "aud": "appstoreconnect-v1"},
        pkey,
        algorithm="ES256",
        headers={"kid": KEY_ID, "typ": "JWT"},
    )


def fetch_feedback(tok: str, kind: str) -> list[dict]:
    """kind = 'betaFeedbackScreenshotSubmissions' | 'betaFeedbackCrashSubmissions'"""
    url = f"{API}/v1/apps/{APP_ID}/{kind}"
    params = {"limit": 200, "include": "tester,build"}
    r = requests.get(url, headers={"Authorization": f"Bearer {tok}"}, params=params, timeout=30)
    if r.status_code != 200:
        print(f"[!] {kind} → {r.status_code}: {r.text[:300]}", file=sys.stderr)
        return []
    return r.json().get("data", [])


def render_screenshot(item: dict) -> None:
    a = item.get("attributes", {})
    print(f"\n--- SCREENSHOT FEEDBACK ---")
    print(f"  id: {item.get('id')}")
    print(f"  created: {a.get('createdDate')}")
    print(f"  build: {a.get('buildBundleId') or '?'} bundleVersion={a.get('bundleVersion') or '?'}")
    print(f"  device: {a.get('deviceModel')} / iOS {a.get('osVersion')}")
    print(f"  email: {a.get('email')}")
    print(f"  comment: {(a.get('comment') or '').strip()}")
    for sc in a.get("screenshots", []) or []:
        print(f"  screenshot: {sc.get('url')}")


def render_crash(item: dict) -> None:
    a = item.get("attributes", {})
    print(f"\n--- CRASH FEEDBACK ---")
    print(f"  id: {item.get('id')}")
    print(f"  created: {a.get('createdDate')}")
    print(f"  build: bundleVersion={a.get('bundleVersion') or '?'}")
    print(f"  device: {a.get('deviceModel')} / iOS {a.get('osVersion')}")
    print(f"  appUptimeMs: {a.get('appUptimeInMilliseconds')}")
    print(f"  battery: {a.get('batteryPercentage')}% disk-free: {a.get('diskBytesAvailable')}")
    print(f"  network: {a.get('connectionType')} carrier: {a.get('carrier')}")
    print(f"  email: {a.get('email')}")
    print(f"  comment: {(a.get('comment') or '').strip()}")
    for log in a.get("crashLogs", []) or []:
        print(f"  crashlog: {log.get('url')}")


def main() -> int:
    if not KEY_PATH.exists():
        print(f"[!] ASC key missing at {KEY_PATH}", file=sys.stderr)
        return 1

    tok = make_token()
    print(f"[asc] authed; pulling LuminaDeck (app id {APP_ID})", file=sys.stderr)

    screenshots = fetch_feedback(tok, "betaFeedbackScreenshotSubmissions")
    crashes = fetch_feedback(tok, "betaFeedbackCrashSubmissions")

    print(f"\n=== {len(screenshots)} SCREENSHOT SUBMISSIONS ===")
    for s in screenshots:
        render_screenshot(s)

    print(f"\n\n=== {len(crashes)} CRASH SUBMISSIONS ===")
    for c in crashes:
        render_crash(c)

    return 0


if __name__ == "__main__":
    sys.exit(main())
