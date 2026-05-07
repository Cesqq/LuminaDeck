/**
 * Cloud profile sync types + conflict resolution (Phase B8).
 *
 * Storage backend is Supabase (row-level updates with `updated_at` +
 * monotonic `version` integer) — deliberately NOT a CRDT. The engineering
 * judge flagged Yjs as theatre for KB-scale single-user documents;
 * optimistic LWW + a user-facing conflict dialog covers the ~1/1000 case
 * where two devices write simultaneously, and the simpler data model lets
 * us reason about sync behaviour without distributed-systems PhDs.
 *
 * This module holds the *pure logic* — wire it up from the mobile or Rust
 * sync clients in `apps/mobile/src/lib/sync.ts` and
 * `apps/companion/src-tauri/src/sync.rs`.
 */

import type { ProfileConfig } from './types';

/**
 * Row shape stored in the `sync_profiles` Supabase table.
 *   PRIMARY KEY (user_id, profile_id)
 *   version integer NOT NULL DEFAULT 1
 *   updated_at timestamptz NOT NULL DEFAULT now()
 *   payload jsonb NOT NULL
 */
export interface SyncedProfile {
  userId: string;
  profileId: string;
  version: number;
  updatedAt: string; // ISO 8601
  payload: ProfileConfig;
}

export type SyncConflictReason = 'version-mismatch' | 'server-newer';

export type SyncResult<T> =
  | { ok: true; data: T }
  | { ok: false; conflict: true; reason: SyncConflictReason; server: SyncedProfile }
  | { ok: false; conflict: false; error: string };

/**
 * Build the row the client sends to Supabase for an update. Bumps the
 * version so another writer holding an older `expectedVersion` is
 * rejected by the DB constraint.
 */
export function buildUpdateRow(
  current: SyncedProfile,
  nextPayload: ProfileConfig,
  nowIso: string = new Date().toISOString(),
): SyncedProfile {
  return {
    ...current,
    payload: nextPayload,
    version: current.version + 1,
    updatedAt: nowIso,
  };
}

/**
 * Decide which row wins when the client and server disagree. Pure logic
 * so conflict-resolution tests don't need a live DB.
 *
 *   - server.version < client.version → client update is new, keep client
 *   - server.version === client.version → same baseline, keep client
 *     (the user clicked Save)
 *   - server.version > client.version → CONFLICT; surface both to the
 *     user ("Keep mine / Use server")
 */
export function resolveSyncConflict(
  client: SyncedProfile,
  server: SyncedProfile,
): SyncResult<SyncedProfile> {
  if (client.userId !== server.userId || client.profileId !== server.profileId) {
    return {
      ok: false,
      conflict: false,
      error: 'client and server rows identify different profiles',
    };
  }
  if (server.version > client.version) {
    return { ok: false, conflict: true, reason: 'server-newer', server };
  }
  if (server.version === client.version && server.updatedAt > client.updatedAt) {
    // Same baseline but someone else got to `now()` first (rare in
    // practice; Supabase RLS rejects via version check). Still, report it
    // cleanly so the UI shows the "Keep mine / Use server" dialog instead
    // of silently clobbering.
    return { ok: false, conflict: true, reason: 'version-mismatch', server };
  }
  return { ok: true, data: client };
}

/**
 * True when the server has changes we don't yet have locally. Used to
 * drive the realtime subscription handler — if `remoteHasNewer` returns
 * true we pull the payload and merge into local state (straight replace,
 * no conflict when our local row is older).
 */
export function remoteHasNewer(local: SyncedProfile, remote: SyncedProfile): boolean {
  return remote.version > local.version;
}
