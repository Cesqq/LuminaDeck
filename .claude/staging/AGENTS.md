# AGENTS.md — LuminaDeck

**Status:** Draft. Staged at `.claude/staging/AGENTS.md` by the LuminaDeck specialist on 2026-05-19. Review and copy to repo root (`C:/Dev/LuminaDeck/AGENTS.md`) when accurate.

This file is the canonical, repo-pinned source of truth for any AI agent or automation that works on LuminaDeck. It defines build/test commands, protected files, open-edit zones, and the conventions that downstream automations (Steve Jobs, the lumina-deck specialist, future agents) MUST respect.

If this file disagrees with any agent's persistent state, **AGENTS.md wins.**

---

## What this app is

LuminaDeck — a customizable phone-side macro deck (iOS + Android, mobile-first) paired with a Windows companion app over local Wi-Fi. iPhone/Android shows a button grid; tap fires keyboard shortcuts, app launches, system actions, OBS scene switches, etc. on the Windows PC. Local-only, no cloud relay, TLS 1.3 + cert-pinned + key-name allowlist.

- **iOS bundle ID:** `com.luminadeck.app` (build 13, v1.4.0)
- **Android package:** `com.luminadeck.app` (versionCode 13, versionName 1.4.0)
- **Tauri companion identifier:** `com.luminadeck.companion` (v1.3.0)
- **MSIX Package Name:** `CZRE.LuminaDeck` — Publisher CN `24DA9F28-A632-4B32-AB31-FAD4EC93A0A2`
- **Apple Team:** `7A2K2PDKW4` (Ceasar Esquivel, Individual)
- **App Group (iOS):** `group.com.luminadeck.shared`

---

## Architecture (one-pager)

- **Monorepo:** pnpm 10.33 + Turborepo (`turbo.json`)
- **Mobile** (`apps/mobile`): Expo SDK 54, React Native 0.81.5, TypeScript, RevenueCat for iOS IAP
- **Companion** (`apps/companion`): Tauri v2, Rust backend (`apps/companion/src-tauri/`), HTML/JS frontend (`apps/companion/src/`)
- **Shared** (`packages/shared`): types, WebSocket protocol, key-name allowlist, payload validation — both apps depend on this
- **MS Store packaging:** `apps/companion/src-tauri/Package.appxmanifest` + `scripts/build-msix.ps1` wraps the Tauri-built `luminadeck-companion.exe` into an MSIX
- **Supabase:** receipt validation (edge functions) + Pro entitlement (cached locally with 7-day grace)

See `docs/LUMINADECK-LAUNCH-PLAN.md` (Section 2) for the ratified architecture detail.

---

## Build / test commands

These are the canonical commands. They live here and NOT in agent state files; agents read them from here.

| Purpose | Command |
|---|---|
| Test + typecheck (full repo) | `npx turbo run test typecheck` |
| Test only | `pnpm test` |
| Typecheck only | `pnpm typecheck` |
| Lint | `pnpm lint` |
| Build (full repo) | `pnpm build` |
| Build companion (Tauri) | `pnpm build:companion` (or `cd apps/companion && npx tauri build`) |
| Build mobile JS bundle | `pnpm build:mobile` |
| Rust check (companion) | `cd apps/companion/src-tauri && cargo check` |
| E2E protocol test (needs companion running) | `node scripts/test-protocol.js` |
| MSIX package build | `pwsh scripts/build-msix.ps1` |
| iOS archive + ASC upload | `bash scripts/sync-to-mac.sh && ssh rsaczr@10.0.0.50 'bash ~/LuminaDeck/scripts/ios-archive-and-upload.sh'` |
| Android release build | Open `apps/mobile/android/` in Android Studio → Build → Generate Signed Bundle → AAB → release (requires upload keystore — not yet generated as of 2026-05-19) |

---

## Protected Files (require 6-of-6 judge consensus to edit)

Any AI agent that touches these MUST run them through the 6-judge panel and get all 6 ≥7 before opening a PR. These are ship-critical, security-critical, or store-identity-critical.

### Tauri companion (Rust backend)
- `apps/companion/src-tauri/Cargo.toml`
- `apps/companion/src-tauri/src/**` (entire Rust source)
- `apps/companion/src-tauri/tauri.conf.json` — especially `identifier`, `version`, `security.csp`, `bundle.targets`
- `apps/companion/src-tauri/Package.appxmanifest` — `<Identity>` block is Partner Center identity; mismatch = upload rejection
- `apps/companion/src-tauri/build.rs`, `capabilities/`

### Shared protocol
- `packages/shared/src/protocol/**` — WebSocket message types, key-name allowlist (~120 valid keys), payload validation. Changing this is a coordinated mobile + companion + key-allowlist change.

### Mobile platform manifests
- `apps/mobile/app.json` — `buildNumber`, `versionCode`, `version`, `bundleIdentifier`, `package`, RevenueCat plugin config, App Group `group.com.luminadeck.shared`, privacy manifest
- `apps/mobile/android/app/build.gradle` — `applicationId`, `versionCode`, `versionName`, `signingConfigs`

### Ship pipelines
- `scripts/sync-to-mac.sh`
- `scripts/ios-archive-and-upload.sh` (referenced from CLAUDE.md — runs on the Mac at `rsaczr@10.0.0.50`)
- `scripts/build-msix.ps1`
- `scripts/patch-react-native-push-notification-ios.cjs` (postinstall — touching this breaks `pnpm install`)

### Secrets / keys
- `.keys/**` — `.keys/AuthKey_5G4BLJ82KH.p8` (ASC API key) and any other private keys. **NEVER commit; NEVER read in agent transcripts.**

### Backend
- `supabase/**` — receipt validator edge functions; touching this affects Pro entitlement correctness across iOS and (future) Android purchases.

---

## Don't-Touch Reasons (passed to the Risk-Regression judge)

- **`packages/shared/src/protocol/**`:** the protocol is the contract between Expo mobile (TypeScript) and the Tauri Rust companion. A breaking change requires coordinated releases on both sides. Mobile updates push immediately on Play/App Store; companion updates push via MS Store + direct download — release skew is real. Always additive, never break-compat.
- **`apps/companion/src-tauri/src/**`:** the Rust backend executes `SendInput` keystrokes. A bug here is a security incident, not a UX bug. The key-name allowlist enforcement and the action-type schema validation live here.
- **`apps/mobile/app.json` (versionCode + buildNumber):** these are managed by the release script — bumping them out-of-band breaks the Mac archive pipeline.
- **`Package.appxmanifest <Identity>`:** Partner Center binds publisher CN + Package Name at first submission. Mismatch = "Package identity mismatch" rejection at upload.
- **`apps/mobile/android/app/build.gradle` signingConfigs:** swapping to a different keystore mid-release invalidates Play upload signatures.
- **`scripts/sync-to-mac.sh` + `ios-archive-and-upload.sh`:** Mac SSH path is the ONLY proven path to a TestFlight build. Headless SSH archive previously failed `errSecInternalComponent`. Do NOT modify until a fix lands.
- **`.keys/`:** the ASC API key (`AuthKey_5G4BLJ82KH.p8`) is the only credential that signs TestFlight uploads. Committing it = full Apple account compromise.
- **`supabase/`:** receipt validator bugs cause entitlement leaks (free users get Pro, or Pro users lose Pro). Local 7-day grace masks bugs for a week — verify with real receipts before merging.

---

## Open-Edit Zones (safe-additive, lighter Risk-Regression scrutiny)

- `apps/mobile/src/screens/**` — new screens or screen-local components
- `apps/mobile/src/components/**` — new components (existing components are Open-Edit only if not currently rendered in the main flow)
- `apps/mobile/assets/**` — new image / icon assets
- `apps/companion/src/**` (HTML/JS frontend, NOT `src-tauri/`) — companion UI changes
- `docs/**` — markdown docs
- `marketing/**` — store-listing copy, screenshots, press kit
- `_daily/**` — daily reports written by the specialist
- `.claude/plans/**`, `.claude/verdicts/**`, `.claude/state/**` — specialist scratch
- New files anywhere under `apps/mobile/src/` or `packages/shared/src/` that don't replace existing files

---

## Conventions

- **Pricing:** Pro = $9.99 one-time. NEVER reference a subscription model in code, copy, or store listings. Subscription = Touch Portal/Stream Deck Mobile competition; our entire Tipsy Angle C is "subscription fatigue antidote".
- **Brand voice:** "Direct" (per `C:/Users/czr05/Tipsy/profiles/lumina-deck.md`). Do-not-say in any user-facing string: `seamless`, `powerful`, `robust`, `revolutionize`, `unleash`, `game-changer`, `next-level`, `supercharge`. No rhetorical-question hooks ("Are you tired of…?").
- **Selected marketing angles:** A (the $150 spite buy), B (your phone is already there), C (subscription fatigue antidote). D (built with AI) is **Tedster lane only — NEVER on @luminaautomations**.
- **No third-party trademarks** in bundled icon packs (per App Store guideline + Tipsy section 4.3). Original generic icons only.
- **Privacy:** local-only by default. No analytics SDKs at launch. NSLocalNetworkUsageDescription is set in `app.json` — keep it human-readable.
- **iOS minimum:** iOS 16+ (per LAUNCH-PLAN section 2.2).
- **Windows minimum:** Windows 10 build 19041 (per `Package.appxmanifest` `MinVersion`).
- **Commits:** no `--no-verify`, no `--no-gpg-sign`. Pre-commit hooks must pass.

---

## Submission status snapshot (as of 2026-05-19)

| Platform | Status | Blocker |
|---|---|---|
| iOS (App Store / TestFlight) | Build 13 archived, RevenueCat-wired | Needs 6.9-inch iPhone + 13-inch iPad screenshots |
| Android (Google Play) | Code ready (versionCode 13) | Upload keystore not generated. See `docs/SETUP-ANDROID-KEYSTORE.md`. |
| MS Store (Partner Center) | MSIX built (`LuminaDeckStudio.msix`) | Needs Studio screenshots + Partner Center submission. Copy ready at `docs/MS-STORE-SUBMISSION-COPY.md`. |

Three independent pipelines, three independent submission states. Rejections on one do NOT block the other two.

---

## graphify

A knowledge graph for this codebase lives at `graphify-out/`.

Rules (from repo `CLAUDE.md`):
- Before answering architecture / codebase questions, read `graphify-out/GRAPH_REPORT.md` for god nodes and community structure.
- If `graphify-out/wiki/index.md` exists, navigate it instead of reading raw files.
- After modifying code files in a session, run `python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"` to keep the graph current.

---

## Refresh policy

This file should be refreshed when:
- A protected file moves or is renamed
- The build pipeline changes (new test command, new build target)
- A new platform pipeline is added (e.g., Mac companion if/when it ships)
- More than 60 days have elapsed since the last refresh (mtime check by the specialist)

Run `python ~/.claude/scripts/sj_seed_agents_md.py --app "LuminaDeck" --force` (when applicable) to regenerate a draft; the lumina-deck specialist will manually re-stage updates here for user review.
