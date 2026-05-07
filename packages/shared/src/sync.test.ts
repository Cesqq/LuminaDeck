import { describe, it, expect } from 'vitest';
import {
  buildUpdateRow,
  resolveSyncConflict,
  remoteHasNewer,
  type SyncedProfile,
} from './sync';
import type { ProfileConfig } from './types';

function row(version: number, updatedAt: string, overrides: Partial<SyncedProfile> = {}): SyncedProfile {
  const profile: ProfileConfig = {
    id: 'p1',
    name: 'Test',
    theme: 'obsidian',
    pages: [{ id: 'pg1', name: 'One', layout: '3x4', buttons: [] }],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt,
  };
  return {
    userId: 'u1',
    profileId: 'p1',
    version,
    updatedAt,
    payload: profile,
    ...overrides,
  };
}

describe('sync', () => {
  it('buildUpdateRow bumps version and updatedAt', () => {
    const current = row(3, '2026-01-01T00:00:00.000Z');
    const next = buildUpdateRow(current, current.payload, '2026-04-22T12:00:00.000Z');
    expect(next.version).toBe(4);
    expect(next.updatedAt).toBe('2026-04-22T12:00:00.000Z');
  });

  it('resolveSyncConflict returns ok when client is newer', () => {
    const client = row(5, '2026-04-22T12:00:00.000Z');
    const server = row(4, '2026-04-22T11:00:00.000Z');
    const result = resolveSyncConflict(client, server);
    expect(result.ok).toBe(true);
  });

  it('resolveSyncConflict returns conflict when server is newer', () => {
    const client = row(3, '2026-04-22T12:00:00.000Z');
    const server = row(5, '2026-04-22T12:30:00.000Z');
    const result = resolveSyncConflict(client, server);
    expect(result.ok).toBe(false);
    if (!result.ok && result.conflict) {
      expect(result.reason).toBe('server-newer');
      expect(result.server.version).toBe(5);
    }
  });

  it('resolveSyncConflict reports version-mismatch on same version + later server timestamp', () => {
    const client = row(4, '2026-04-22T12:00:00.000Z');
    const server = row(4, '2026-04-22T12:30:00.000Z');
    const result = resolveSyncConflict(client, server);
    expect(result.ok).toBe(false);
    if (!result.ok && result.conflict) {
      expect(result.reason).toBe('version-mismatch');
    }
  });

  it('resolveSyncConflict errors when rows identify different profiles', () => {
    const client = row(1, '2026-04-22T12:00:00.000Z');
    const server = row(1, '2026-04-22T12:00:00.000Z', { profileId: 'p2' });
    const result = resolveSyncConflict(client, server);
    expect(result.ok).toBe(false);
    if (!result.ok && !result.conflict) {
      expect(result.error).toMatch(/different profiles/);
    }
  });

  it('remoteHasNewer reflects strict version comparison', () => {
    expect(
      remoteHasNewer(row(3, '2026-01-01T00:00:00.000Z'), row(4, '2026-01-01T00:00:00.000Z')),
    ).toBe(true);
    expect(
      remoteHasNewer(row(3, '2026-01-01T00:00:00.000Z'), row(3, '2026-01-01T00:00:00.000Z')),
    ).toBe(false);
  });
});
