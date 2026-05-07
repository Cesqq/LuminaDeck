import { describe, it, expect } from 'vitest';
import { PROFILE_PACKS, instantiatePack } from './index';
import { profileConfigSchema } from '../validation';

/**
 * Smoke tests for the first-party profile packs. Each pack is hand-authored
 * TypeScript, so we want an automated check that every tile passes the same
 * Zod schema real user-imported profiles would pass — this catches typos in
 * keybind keys (which hit the allowlist) and malformed action payloads at
 * build time instead of runtime.
 */

describe('Profile Packs', () => {
  it('exports eight packs', () => {
    expect(PROFILE_PACKS).toHaveLength(8);
  });

  it('every pack has a unique id', () => {
    const ids = PROFILE_PACKS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every pack passes profileConfigSchema validation', () => {
    for (const pack of PROFILE_PACKS) {
      const result = profileConfigSchema.safeParse(pack.profile);
      if (!result.success) {
        throw new Error(
          `Pack "${pack.id}" failed schema: ${result.error.issues.map((i) => i.message).join('; ')}`,
        );
      }
      expect(result.success).toBe(true);
    }
  });

  it('every pack has at least one page with at least one button', () => {
    for (const pack of PROFILE_PACKS) {
      expect(pack.profile.pages.length).toBeGreaterThan(0);
      for (const page of pack.profile.pages) {
        expect(page.buttons.length).toBeGreaterThan(0);
      }
    }
  });

  it('DAW, video, and coder packs are Pro-gated; streaming/vtuber/soundboard packs are free', () => {
    const byCategory = new Map(PROFILE_PACKS.map((p) => [p.id, p]));
    expect(byCategory.get('ableton-live')?.isProOnly).toBe(true);
    expect(byCategory.get('fl-studio')?.isProOnly).toBe(true);
    expect(byCategory.get('davinci-resolve')?.isProOnly).toBe(true);
    expect(byCategory.get('premiere-jkl')?.isProOnly).toBe(true);
    expect(byCategory.get('vtube-studio')?.isProOnly).toBe(false);
    expect(byCategory.get('obs-streaming')?.isProOnly).toBe(false);
    expect(byCategory.get('coder')?.isProOnly).toBe(true);
    expect(byCategory.get('soundboard')?.isProOnly).toBe(false);
  });

  it('instantiatePack regenerates ids and timestamps', () => {
    const source = PROFILE_PACKS[0]!;
    const inst = instantiatePack(source);
    expect(inst.id).not.toBe(source.profile.id);
    expect(inst.createdAt).not.toBe(source.profile.createdAt);
    for (let i = 0; i < inst.pages.length; i++) {
      expect(inst.pages[i]!.id).not.toBe(source.profile.pages[i]!.id);
      for (let j = 0; j < inst.pages[i]!.buttons.length; j++) {
        expect(inst.pages[i]!.buttons[j]!.id).not.toBe(source.profile.pages[i]!.buttons[j]!.id);
      }
    }
  });

  it('instantiatePack keeps the same tile count and actions', () => {
    const source = PROFILE_PACKS.find((p) => p.id === 'obs-streaming')!;
    const inst = instantiatePack(source);
    const sourceCount = source.profile.pages.reduce((n, p) => n + p.buttons.length, 0);
    const instCount = inst.pages.reduce((n, p) => n + p.buttons.length, 0);
    expect(instCount).toBe(sourceCount);
    expect(inst.pages[0]!.buttons[0]!.action).toEqual(source.profile.pages[0]!.buttons[0]!.action);
  });
});
