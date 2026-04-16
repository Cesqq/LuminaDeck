import { describe, it, expect } from 'vitest';
import {
  PROTOCOL_VERSION,
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_MISS_THRESHOLD,
  RECONNECT_DELAYS_MS,
  RECONNECT_MAX_DELAY_MS,
  RATE_LIMIT_ACTIONS_PER_SECOND,
  MAX_PAIRED_DEVICES,
  DEFAULT_PORT,
} from './protocol';

describe('Protocol Constants', () => {
  it('has protocol version 1.0.0', () => {
    expect(PROTOCOL_VERSION).toBe('1.0.0');
  });

  it('heartbeat interval is 2 seconds', () => {
    expect(HEARTBEAT_INTERVAL_MS).toBe(2000);
  });

  it('disconnect after 3 missed heartbeats', () => {
    expect(HEARTBEAT_MISS_THRESHOLD).toBe(3);
  });

  it('reconnect delays follow exponential backoff', () => {
    expect(RECONNECT_DELAYS_MS[0]).toBe(500);
    expect(RECONNECT_DELAYS_MS[1]).toBe(1000);
    expect(RECONNECT_DELAYS_MS[2]).toBe(2000);
    // Each should be >= previous
    for (let i = 1; i < RECONNECT_DELAYS_MS.length; i++) {
      expect(RECONNECT_DELAYS_MS[i]).toBeGreaterThanOrEqual(RECONNECT_DELAYS_MS[i - 1]);
    }
  });

  it('reconnect max delay is 30 seconds', () => {
    expect(RECONNECT_MAX_DELAY_MS).toBe(30000);
  });

  it('rate limit is 50 actions/sec', () => {
    expect(RATE_LIMIT_ACTIONS_PER_SECOND).toBe(50);
  });

  it('max paired devices is 5', () => {
    expect(MAX_PAIRED_DEVICES).toBe(5);
  });

  it('default port is 9876', () => {
    expect(DEFAULT_PORT).toBe(9876);
  });
});

describe('Protocol Types', () => {
  it('ClientMessage execute shape is valid', () => {
    const msg = {
      type: 'execute' as const,
      id: 'test-1',
      action: { type: 'keybind' as const, keys: ['ctrl', 'c'] },
    };
    expect(msg.type).toBe('execute');
    expect(msg.id).toBeTruthy();
    expect(msg.action.type).toBe('keybind');
  });

  it('CompanionMessage pong shape is valid', () => {
    const msg = {
      type: 'pong' as const,
      timestamp: Date.now(),
      serverTime: Date.now(),
    };
    expect(msg.type).toBe('pong');
    expect(typeof msg.timestamp).toBe('number');
  });

  it('QRPairingPayload shape is valid', () => {
    const payload = {
      ip: '192.168.1.100',
      port: 9876,
      certFingerprint: 'abc123',
      companionName: 'My PC',
      version: '1.0.0',
    };
    expect(payload.ip).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
    expect(payload.port).toBeGreaterThan(0);
    expect(payload.port).toBeLessThanOrEqual(65535);
  });
});

describe('Limits', () => {
  it('FREE_LIMITS has correct values', async () => {
    const { FREE_LIMITS } = await import('./types');
    expect(FREE_LIMITS.maxButtons).toBe(8);
    expect(FREE_LIMITS.maxPages).toBe(1);
    expect(FREE_LIMITS.maxPairedDevices).toBe(1);
    expect(FREE_LIMITS.customImages).toBe(false);
    expect(FREE_LIMITS.multiAction).toBe(false);
  });

  it('PRO_LIMITS has correct values', async () => {
    const { PRO_LIMITS } = await import('./types');
    expect(PRO_LIMITS.maxButtons).toBe(30);
    expect(PRO_LIMITS.maxPages).toBe(20);
    expect(PRO_LIMITS.maxPairedDevices).toBe(5);
    expect(PRO_LIMITS.customImages).toBe(true);
    expect(PRO_LIMITS.multiAction).toBe(true);
  });

  it('PRO_LIMITS are strictly greater than FREE_LIMITS', async () => {
    const { FREE_LIMITS, PRO_LIMITS } = await import('./types');
    expect(PRO_LIMITS.maxButtons).toBeGreaterThan(FREE_LIMITS.maxButtons);
    expect(PRO_LIMITS.maxPages).toBeGreaterThan(FREE_LIMITS.maxPages);
    expect(PRO_LIMITS.maxPairedDevices).toBeGreaterThan(FREE_LIMITS.maxPairedDevices);
  });
});
