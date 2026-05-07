import { describe, it, expect } from 'vitest';
import { mergeStoredMacros } from './macros';
import type { MacroConfig } from './macros';

function macro(id: string, name = id): MacroConfig {
  return {
    id,
    name,
    steps: [],
    triggers: [{ type: 'button' }],
    createdAt: '2026-04-28T00:00:00.000Z',
    updatedAt: '2026-04-28T00:00:00.000Z',
  };
}

describe('mergeStoredMacros', () => {
  it('returns stored when current is empty', () => {
    const stored = [macro('a'), macro('b')];
    expect(mergeStoredMacros([], stored)).toEqual(stored);
  });

  it('returns current and appends stored entries with new IDs', () => {
    const current = [macro('a')];
    const stored = [macro('b'), macro('c')];
    const merged = mergeStoredMacros(current, stored);
    expect(merged.map((m) => m.id)).toEqual(['a', 'b', 'c']);
  });

  it('preserves current state when ID conflicts (user wins)', () => {
    const userEdit = macro('a', 'User Edit');
    const stored = macro('a', 'Stored Old');
    const merged = mergeStoredMacros([userEdit], [stored]);
    expect(merged).toHaveLength(1);
    expect(merged[0].name).toBe('User Edit');
  });

  it('drops no entries when no IDs overlap', () => {
    const current = [macro('a'), macro('b')];
    const stored = [macro('c'), macro('d')];
    expect(mergeStoredMacros(current, stored)).toHaveLength(4);
  });

  it('handles empty stored list', () => {
    const current = [macro('a')];
    expect(mergeStoredMacros(current, [])).toEqual(current);
  });

  it('handles both empty', () => {
    expect(mergeStoredMacros([], [])).toEqual([]);
  });

  it('does not mutate inputs', () => {
    const current = [macro('a')];
    const stored = [macro('b')];
    const currentCopy = [...current];
    const storedCopy = [...stored];
    mergeStoredMacros(current, stored);
    expect(current).toEqual(currentCopy);
    expect(stored).toEqual(storedCopy);
  });

  // Regression test for the iPhone bug: user creates a macro before
  // AsyncStorage.getItem resolves; the late-arriving load callback used to
  // call `setMacros(stored)` and clobber the user's new macro entirely.
  it('regression: user-created macro survives a late-arriving load with stored data', () => {
    // User created this between mount and load resolution
    const userMacro = macro('user-new', 'Just Created');
    // What was already in storage before the user's session
    const stored = [macro('old-a'), macro('old-b')];

    const merged = mergeStoredMacros([userMacro], stored);

    expect(merged.map((m) => m.id)).toContain('user-new');
    expect(merged.map((m) => m.id)).toContain('old-a');
    expect(merged.map((m) => m.id)).toContain('old-b');
    expect(merged).toHaveLength(3);
  });
});
