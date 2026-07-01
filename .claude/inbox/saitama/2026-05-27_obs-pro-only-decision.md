---
from: saitama
to: lumina-deck-specialist
date: 2026-05-27
topic: obs-pro-only-decision
priority: high
---

# OBS control = Pro-only (decision landed)

Czr decided 2026-05-27: OBS scene/source control is a **Pro-tier (paid) feature**, not free-to-all. This resolves the M2 policy fork that was blocking the milestone (open since 5/24).

**Bounded M2 scope now unblocked:**
- Un-stub `toggle_source` (companion: `obs.rs` / `server.rs`)
- Gate `replay_buffer` + `obs_screenshot` behind the Pro entitlement — reuse the existing `feature-gates.ts` RevenueCat pattern
- These become paywalled capabilities; they strengthen the subscription pitch.

**Working-tree caution + SPECIFIC CONFLICT (from 5/27 investigation):** the tree is DIRTY (uncommitted: `feature-gates.ts`/`.test.ts`, companion `obs.rs`/`server.rs`, untracked `.claude/`, `marketing/iap-review/`). ⚠️ The `feature-gates.ts` WIP flips `obs` to `{free:true, pro:true}` — OBS free for everyone, the OPPOSITE of this Pro-only decision. Before committing: revert `obs` to `{free:false, pro:true}` and fix the 5 assertions in `feature-gates.test.ts`. KEEP the companion `obs.rs`/`server.rs` WIP (real `toggle_source`/`replay_buffer` impl + `"obs"` capability — good work). Don't lose it, don't blindly stash.

**Submit-now context (investigation verdict):** iOS build 13 is essentially submit-ready — paywall IS wired (RevenueCat; it's a one-time **Lifetime Pro** unlock, NOT a subscription), ascAppId `6762442797`, EAS submit configured, iPhone/iPad screenshots valid, paywall review shot at `marketing/iap-review/`. OBS/M2 is a confirmed FAST-FOLLOW, not a launch blocker (iOS never imports OBS — companion-only). The reviewer notes from 2026-04-29 say "no paywall" → MUST be rewritten to describe the Lifetime Pro IAP. Founder-gated: create the Non-Consumable IAP in ASC + confirm the RevenueCat offering + hit Submit.

**Bigger picture (Saitama):** Czr's #1 priority this week is FIRST REVENUE. If iOS build 13 (RevenueCat-wired) is submittable now with the paywall working, submitting iOS may beat finishing M2 — treat OBS/M2 as a fast-follow unless it's a hard launch blocker. A parallel investigation is determining shortest-path-to-iOS-submission; coordinate with its finding.

**Action requested:** on next invocation — surface this to Czr, commit the WIP safely, then either (a) execute the bounded M2 Pro-gating, or (b) prioritize iOS submission first per the revenue investigation. Recommend which.

**Source:** Saitama working session 2026-05-27.
