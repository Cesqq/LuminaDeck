#!/usr/bin/env python3
"""DOES NOT WORK — kept for reference. App Group management is NOT
exposed via the public App Store Connect REST API:

    GET /v1/appGroups → 404 (endpoint does not exist)
    GET /v1/bundleIdCapabilities → 403 (gated even for listing)

Verified 2026-04-29 with our standard ASC API key (.p8). Apple's only
automation path for App Groups is fastlane's `spaceship`, which uses
Apple ID + 2FA session cookies (`fastlane spaceauth`). Anything that
requires capturing the Apple ID password is off-limits for the LuminaDeck
agent.

This means App Group creation is a permanent **human web-portal step**:

    https://developer.apple.com/account/resources/identifiers/
    → top-left dropdown: "App Groups" → + → identifier "group.com.luminadeck.shared"
    → also visit each App ID, enable App Groups + Keychain Sharing
      capabilities, and tick this group under App Groups → Configure.

The auth + bundle-listing code below works fine if a later API revision
ever opens up `/v1/appGroups`; preserved as scaffolding.
"""

from __future__ import annotations

import json
import os
import sys
import time
import uuid
from pathlib import Path

import jwt  # PyJWT
import requests

# --- credentials (mirrors ~/.claude/CLAUDE.md project block) ---
KEY_ID = "5G4BLJ82KH"
ISSUER_ID = "b9dc67a7-763a-4031-aa71-ada7964eddd5"
KEY_PATH = Path.home() / ".keys" / f"AuthKey_{KEY_ID}.p8"
TEAM_ID = "7A2K2PDKW4"

# --- targets ---
APP_GROUP_ID = "group.com.luminadeck.shared"
APP_GROUP_NAME = "LuminaDeck Shared"
MAIN_BUNDLE = "com.luminadeck.app"
WIDGET_BUNDLE = "com.luminadeck.app.widget"
WATCH_BUNDLE = "com.luminadeck.app.watchkitapp"

# Bundle IDs that need the App Group + Keychain Sharing capabilities.
# Watch is omitted because v1.4 Mac archive script gates it on
# ENABLE_WATCH=1 — we'll loop the user back here when they flip it on.
BUNDLES = [
    (MAIN_BUNDLE, "LuminaDeck"),
    (WIDGET_BUNDLE, "LuminaDeck Widget"),
]

API = "https://api.appstoreconnect.apple.com"


def make_token() -> str:
    pkey = KEY_PATH.read_text()
    now = int(time.time())
    payload = {
        "iss": ISSUER_ID,
        "iat": now,
        "exp": now + 19 * 60,  # max 20 min for API key tokens
        "aud": "appstoreconnect-v1",
    }
    return jwt.encode(payload, pkey, algorithm="ES256", headers={"kid": KEY_ID, "typ": "JWT"})


def headers(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


def log(label: str, *args) -> None:
    print(f"[asc] {label}", *args, flush=True)


def get_first(tok: str, path: str, params: dict | None = None) -> dict | None:
    r = requests.get(f"{API}{path}", headers=headers(tok), params=params, timeout=20)
    if r.status_code == 200:
        data = r.json().get("data") or []
        return data[0] if data else None
    if r.status_code in (401, 403):
        raise SystemExit(
            f"\n[asc] auth failed on GET {path} ({r.status_code}). "
            f"This API key likely lacks the required role for App Group "
            f"management. Fall back to the web portal flow.\n"
            f"  body: {r.text[:400]}"
        )
    raise RuntimeError(f"GET {path} → {r.status_code}: {r.text[:400]}")


def post(tok: str, path: str, body: dict) -> dict:
    r = requests.post(f"{API}{path}", headers=headers(tok), json=body, timeout=20)
    if r.status_code in (200, 201):
        return r.json().get("data", {})
    if r.status_code in (401, 403):
        raise SystemExit(
            f"\n[asc] auth/permission failed on POST {path} ({r.status_code}). "
            f"Most likely the API key isn't allowed to create the resource. "
            f"Fall back to the web portal flow.\n"
            f"  body: {r.text[:400]}"
        )
    if r.status_code == 409:
        log(f"already exists: {path}")
        return {}
    raise RuntimeError(f"POST {path} → {r.status_code}: {r.text[:600]}")


def ensure_app_group(tok: str) -> str:
    existing = get_first(tok, "/v1/appGroups", {"filter[identifier]": APP_GROUP_ID})
    if existing:
        log(f"app group present: {APP_GROUP_ID} (id={existing['id']})")
        return existing["id"]

    log(f"creating app group: {APP_GROUP_ID}")
    body = {
        "data": {
            "type": "appGroups",
            "attributes": {"identifier": APP_GROUP_ID, "name": APP_GROUP_NAME},
        }
    }
    created = post(tok, "/v1/appGroups", body)
    return created["id"]


def ensure_bundle(tok: str, identifier: str, name: str) -> str:
    existing = get_first(tok, "/v1/bundleIds", {"filter[identifier]": identifier})
    if existing:
        log(f"bundle present: {identifier} (id={existing['id']})")
        return existing["id"]

    log(f"creating bundle: {identifier}")
    body = {
        "data": {
            "type": "bundleIds",
            "attributes": {"identifier": identifier, "name": name, "platform": "IOS"},
        }
    }
    created = post(tok, "/v1/bundleIds", body)
    return created["id"]


def ensure_capability(tok: str, bundle_id: str, capability_type: str) -> None:
    """Create a `bundleIdCapabilities` row of the given type if missing."""
    r = requests.get(
        f"{API}/v1/bundleIds/{bundle_id}/bundleIdCapabilities",
        headers=headers(tok),
        timeout=20,
    )
    if r.status_code in (401, 403):
        raise SystemExit(f"[asc] auth failed reading caps: {r.text[:300]}")
    existing = []
    if r.status_code == 200:
        existing = [
            row.get("attributes", {}).get("capabilityType")
            for row in r.json().get("data", [])
        ]
    if capability_type in existing:
        log(f"capability present: {capability_type} on {bundle_id}")
        return

    log(f"adding capability: {capability_type} → {bundle_id}")
    body = {
        "data": {
            "type": "bundleIdCapabilities",
            "attributes": {"capabilityType": capability_type},
            "relationships": {
                "bundleId": {"data": {"type": "bundleIds", "id": bundle_id}}
            },
        }
    }
    post(tok, "/v1/bundleIdCapabilities", body)


def link_app_group(tok: str, bundle_id: str, app_group_id: str) -> None:
    """Attach the App Group to a bundle's `appGroups` relationship.
    PATCH replaces the entire link list, so we GET first and merge."""
    r = requests.get(
        f"{API}/v1/bundleIds/{bundle_id}/relationships/appGroups",
        headers=headers(tok),
        timeout=20,
    )
    if r.status_code != 200:
        log(f"  warn: couldn't read existing app group link for {bundle_id}: {r.status_code}")
        existing_ids = []
    else:
        existing_ids = [row["id"] for row in r.json().get("data", [])]

    if app_group_id in existing_ids:
        log(f"app group already linked to {bundle_id}")
        return

    merged = list({*existing_ids, app_group_id})
    log(f"linking app group → {bundle_id} (now: {merged})")
    body = {"data": [{"type": "appGroups", "id": gid} for gid in merged]}
    r = requests.patch(
        f"{API}/v1/bundleIds/{bundle_id}/relationships/appGroups",
        headers=headers(tok),
        json=body,
        timeout=20,
    )
    if r.status_code not in (200, 204):
        if r.status_code in (401, 403):
            raise SystemExit(
                f"[asc] auth failed linking app group ({r.status_code}). "
                f"Web portal fallback required.\n  body: {r.text[:400]}"
            )
        raise RuntimeError(f"PATCH appGroups → {r.status_code}: {r.text[:400]}")


def main() -> int:
    if not KEY_PATH.exists():
        log(f"ASC key not found at {KEY_PATH}")
        return 1

    tok = make_token()
    log(f"authenticated; team={TEAM_ID}, key={KEY_ID}")

    # 1. Ensure the App Group itself exists.
    app_group_id = ensure_app_group(tok)

    # 2/3. For each bundle: ensure it exists, enable capabilities, link the app group.
    for identifier, name in BUNDLES:
        bundle_id = ensure_bundle(tok, identifier, name)
        ensure_capability(tok, bundle_id, "APP_GROUPS")
        ensure_capability(tok, bundle_id, "KEYCHAIN_SHARING")
        link_app_group(tok, bundle_id, app_group_id)

    log("done. all targets have App Group + Keychain Sharing wired.")
    log(f"App Group resource id: {app_group_id}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
