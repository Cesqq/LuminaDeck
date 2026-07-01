# Plan: M2 — OBS control as a Pro feature

- **Feature ID:** `feat-2026-05-30-obs-pro-gate-m2`
- **Branch (when built):** `specialist/m2-obs-pro-gate` (already exists; the rescue commit `8848215` lives here)
- **Gate at time of writing:** `orientation` → **this is a PLAN ONLY.** No new feature code is written under this gate. The OBS-Pro *value correction* + Rust WIP rescue already shipped in `8848215` (a safe fix, not new feature code). The three implementation steps below execute only after the user flips the gate to `copilot` (for the 6-judge panel) → `autonomous` (to build + PR).
- **Source of truth:** Saitama note `2026-05-27_obs-pro-only-decision.md` — "OBS scene/source control is a Pro-tier paid feature."

---

## A → B

**A (now, after `8848215`):**
- `FEATURE_GATES.obs = { free: false, pro: true }` — correct Pro-only value, verified by `turbo run test typecheck` (129 tests pass).
- Companion Rust backend has a real `request_response` (correlates OBS responses by `requestId`), a working `toggle_source`, a `replay_buffer` impl, and `obs_screenshot` deferred with a clear "no destination path" error. `"obs"` is in `ADVERTISED_CAPABILITIES`.
- BUT: OBS is **not selectable in the mobile EditorScreen** — `ACTION_TYPES` has no `obs` entry, and its `proOnly` flags are hardcoded (duplicating `FEATURE_GATES`).

**B (target):**
- A Pro (or comp-code) user can add an OBS action in the editor; a free user sees it Pro-locked behind the existing paywall affordance.
- `toggle_source`, `replay_buffer`, and `obs_screenshot` are reachable through the editor and gated by the Pro entitlement at the editor boundary (the companion already executes them; OBS itself never needs to know about the paywall).

---

## Scope (bounded, 3 steps)

### Step 1 — Finish `toggle_source` end-to-end (mostly done in `8848215`)
- Rust `toggle_source` impl is committed. Remaining: confirm the action payload shape (`{ type: 'obs', command: 'toggle_source', sourceName }`) round-trips through `packages/shared/src/protocol` validation and is accepted by `server.rs` action dispatch.
- **Protocol is a PROTECTED path** (`packages/shared/src/protocol/**`). If the OBS payload already validates (it predates this work — `obs` action type exists in `types.ts`/`action-forms.ts`), Step 1 is **no protocol change**, just a verification + an E2E check via `node scripts/test-protocol.js` (companion running). If a protocol change IS required, that is a separate coordinated mobile+companion change and gets split out — do NOT fold it in here.

### Step 2 — Gate `replay_buffer` + `obs_screenshot` behind Pro
- These are OBS *commands* under the single `obs` action type, which is already Pro-gated by `FEATURE_GATES.obs`. So gating happens at the action-type level (Step 3), not per-command — no separate per-command entitlement is needed.
- `obs_screenshot` stays runtime-deferred in Rust (returns the clear "no destination path" error from `8848215`) until a screenshot-path policy is decided. The editor may still offer it; it fails gracefully companion-side. **Flag for the user:** decide whether to (a) hide `obs_screenshot` in the editor until the path policy lands, or (b) show it and let it fail-with-message. Default: **(a) hide it** — don't ship a button that always errors.

### Step 3 — Enforce in EditorScreen via the feature gate (the real work)
- File: `apps/mobile/src/screens/EditorScreen.tsx`.
- Add an `obs` entry to `ACTION_TYPES`. The existing render already does `const disabled = proOnly && !isPro` (line ~529) and shows the Pro-lock treatment, and `usePro()` is already wired (line 175) — so adding the entry is the entire enforcement hook.
- **Derive `proOnly` from `FEATURE_GATES`, don't hardcode it.** Today `ACTION_TYPES` hardcodes `proOnly` per row, which duplicates the shared map and is exactly how the OBS-free-for-all WIP bug almost shipped. Compute `proOnly: !FEATURE_GATES[<feature>].free` from the shared `ACTION_TYPE_TO_FEATURE` mapping (already defined in `feature-gates.test.ts`; promote it into `feature-gates.ts` as an export so the editor and the test share one source). For `obs` → `!FEATURE_GATES.obs.free` = `!false` = `true` (Pro-locked). **This refactor of the hardcoded flags is a stylistic/architectural fork → surface to the user before writing it** (per the open-scope pause rule); if the user prefers minimal change, just add `{ value: 'obs', label: 'OBS', proOnly: true }` literally and leave the de-duplication for later.
- Free user tapping the locked OBS type routes to the existing paywall affordance (same path as `multi_action`/`discord`). No new paywall UI.

---

## Out of scope (do NOT do here)
- Touching `apps/companion/src-tauri/src/**` further (Rust impl is already committed and is a protected path).
- Any change to `packages/shared/src/protocol/**` (protected; would be a separate coordinated change).
- The `obs_screenshot` destination-path policy (separate decision; tracked as a follow-up).
- Anything in the iOS submission path — **iOS never imports OBS** (companion-only feature). M2 does not block iOS submission.

---

## Tests / verification
- `npx turbo run test typecheck` — must stay green (the `test_command` candidate). The `feature-gates.test.ts` "Rust ADVERTISED_CAPABILITIES in sync" assertion already covers the `"obs"` capability.
- `cd apps/companion/src-tauri && cargo check` (+ `cargo test` if present) — the Rust WIP is NOT in `turbo` scope and must be checked separately before any PR.
- `node scripts/test-protocol.js` with the companion running — E2E for the OBS action round-trip (skip in headless CI, flag it).
- Add an EditorScreen test asserting the `obs` action type renders disabled when `!isPro` and enabled when `isPro` (mirrors the existing `proOnly` rows).

---

## 6-judge pre-read (panel runs at `copilot` gate, not now)
- **Architecture (8):** reuses the existing `FEATURE_GATES` → `ACTION_TYPES` pattern; the de-dup refactor *reduces* tech debt. Caveat: the protocol is protected — Step 1 must be verify-only or split.
- **Test Coverage:** capped ≤4 until `test_command` is set in state (candidate `npx turbo run test typecheck` is ready to wire). Lifts once set.
- **Risk-Regression (7):** OBS is a NEW gated capability; main risk is the protected-protocol boundary (mitigated: verify-only) and the hardcoded-flag refactor (mitigated: gated behind user approval / optional).
- **UX Impact (8):** Pro users gain OBS control; free users see a consistent Pro-lock, no regression to existing actions.
- **Product/Brand-Fit (8):** strengthens the one-time **Lifetime Pro** pitch (Tipsy Angle C, subscription-fatigue antidote). No do-not-say words; "OBS control" is plain.
- **Scope (7):** single-session for Step 3 (mobile only) if Steps 1–2 are verify/no-op. If a protocol change surfaces, split → multi-platform L-complexity.

---

## Recommendation to the user
**Prioritize iOS submission first; OBS/M2 is a fast-follow.** Per the Saitama note, this week's #1 goal is FIRST REVENUE, iOS build 13 is essentially submit-ready (paywall wired, Lifetime Pro), and iOS never imports OBS. Ship iOS, then flip the gate to `copilot`/`autonomous` and execute Step 3 (the only real work) on this branch.
