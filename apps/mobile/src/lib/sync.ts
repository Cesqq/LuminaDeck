/**
 * Supabase cloud-sync client for LuminaDeck mobile (Phase B8).
 *
 * This module scaffolds the contract for syncing profiles across devices.
 * The actual `@supabase/supabase-js` SDK is NOT yet added to the mobile
 * package — we're waiting for the user to create the Supabase project and
 * run the table migrations in `supabase/migrations/<tba>.sql`. Until then
 * this module short-circuits every method with a "sync disabled" result
 * so the UI can render the Cloud Sync toggle and show an appropriate
 * empty state.
 *
 * The pure conflict logic lives in `@luminadeck/shared/sync.ts` and is
 * unit-tested there; this module is the *wiring*.
 *
 * Follow-up to wire for real:
 *   1. `pnpm --filter @luminadeck/mobile add @supabase/supabase-js`
 *   2. Set `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY`
 *      in Expo env. We deliberately use the public anon key — row-level
 *      security policies in Supabase enforce per-user isolation.
 *   3. Create table `sync_profiles (user_id uuid, profile_id text, version int,
 *      updated_at timestamptz, payload jsonb, PRIMARY KEY (user_id, profile_id))`
 *      with RLS `auth.uid() = user_id` on select/insert/update/delete.
 *   4. Replace the placeholder `getClient()` / `ensureSignedIn()` impls.
 */

import type { ProfileConfig } from '@luminadeck/shared';
import {
  resolveSyncConflict,
  buildUpdateRow,
  type SyncedProfile,
  type SyncResult,
} from '@luminadeck/shared';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export function isSyncConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

/** Typed error the UI can render distinctly from "conflict" or "success". */
export type SyncError =
  | 'not-configured'
  | 'not-signed-in'
  | 'network'
  | 'server';

/**
 * Pull the row for the given profile from Supabase. Placeholder — see
 * module-level docs. Returns `not-configured` until the SDK lands.
 */
export async function pullProfile(_profileId: string): Promise<SyncResult<SyncedProfile> | { ok: false; conflict: false; error: SyncError }> {
  if (!isSyncConfigured()) {
    return { ok: false, conflict: false, error: 'not-configured' };
  }
  // TODO(B8 follow-up): call supabase.from('sync_profiles').select().eq(...).
  return { ok: false, conflict: false, error: 'network' };
}

/**
 * Push a new version of `profile` to Supabase. On a concurrent-write
 * conflict, callers receive the server row so the "Keep mine / Use server"
 * dialog can render.
 */
export async function pushProfile(
  current: SyncedProfile,
  nextPayload: ProfileConfig,
): Promise<SyncResult<SyncedProfile> | { ok: false; conflict: false; error: SyncError }> {
  if (!isSyncConfigured()) {
    return { ok: false, conflict: false, error: 'not-configured' };
  }
  const update = buildUpdateRow(current, nextPayload);
  // TODO(B8 follow-up): attempt the update with `.eq('version', current.version)`.
  //   If zero rows matched, re-select the server row and call resolveSyncConflict().
  //   If the update succeeded, return { ok: true, data: update }.
  return { ok: true, data: update };
}

/**
 * Subscribe to server-side changes for the given profile. Returns an
 * unsubscribe handle. Placeholder — the real impl plugs into
 * `supabase.channel(...)` and calls back when a server row updates.
 */
export function subscribeProfile(
  _profileId: string,
  _onRemoteChange: (row: SyncedProfile) => void,
): () => void {
  if (!isSyncConfigured()) return () => {};
  // TODO(B8 follow-up): supabase.channel(...).on('postgres_changes', ...).subscribe()
  return () => {};
}

/** Re-export so call sites don't have to reach into shared for the core helper. */
export { resolveSyncConflict };
