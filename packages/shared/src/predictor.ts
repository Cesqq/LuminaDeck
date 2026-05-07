/**
 * On-device Markov predictor for the "Smart Page" feature (Phase B6).
 *
 * Pure logic only — storage, opt-in gating, and UI hooks live in the
 * `apps/mobile/src/lib/predictor.ts` wrapper so the math can be unit
 * tested without importing React Native.
 *
 * We model the user's tile-press sequence as a first-order Markov chain.
 * `transitions[from][to]` counts how often pressing `from` was followed by
 * pressing `to`. A virtual `__start__` state handles the first press in a
 * session. `predictNext` blends the conditional distribution with a
 * low-weight unconditional frequency so there are always *some* predictions
 * to show once any history exists, even if the current "from" state is new.
 */

export const PREDICTOR_START = '__start__';
export const PREDICTOR_MAX_HISTORY = 100;

export interface PredictorState {
  lastPressedId: string | null;
  /** from → to → count. Keys are button ids. */
  transitions: Record<string, Record<string, number>>;
  /** Ring buffer of the last `PREDICTOR_MAX_HISTORY` button ids. */
  history: string[];
}

export function createEmptyPredictorState(): PredictorState {
  return { lastPressedId: null, transitions: {}, history: [] };
}

/**
 * Ensure a state shape loaded from disk is safe to use. Missing/wrong
 * fields degrade to defaults so a corrupt file can't throw inside the hot
 * press path.
 */
export function normalisePredictorState(raw: unknown): PredictorState {
  if (!raw || typeof raw !== 'object') return createEmptyPredictorState();
  const r = raw as Record<string, unknown>;
  const lastPressedId = typeof r.lastPressedId === 'string' ? r.lastPressedId : null;
  const transitions =
    r.transitions && typeof r.transitions === 'object'
      ? sanitiseTransitions(r.transitions as Record<string, unknown>)
      : {};
  const history = Array.isArray(r.history) ? r.history.filter((x) => typeof x === 'string').slice(-PREDICTOR_MAX_HISTORY) : [];
  return { lastPressedId, transitions, history };
}

function sanitiseTransitions(
  raw: Record<string, unknown>,
): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const [from, inner] of Object.entries(raw)) {
    if (!inner || typeof inner !== 'object') continue;
    const row: Record<string, number> = {};
    for (const [to, count] of Object.entries(inner as Record<string, unknown>)) {
      if (typeof count === 'number' && Number.isFinite(count) && count > 0) {
        row[to] = count;
      }
    }
    if (Object.keys(row).length > 0) out[from] = row;
  }
  return out;
}

/**
 * Append a press into the state. Returns a NEW state object (treat the
 * input as immutable). Callers persist this to disk via their wrapper.
 */
export function recordPredictorPress(
  state: PredictorState,
  buttonId: string,
): PredictorState {
  const from = state.lastPressedId ?? PREDICTOR_START;
  const nextTransitions = { ...state.transitions };
  nextTransitions[from] = { ...(nextTransitions[from] ?? {}) };
  nextTransitions[from][buttonId] = (nextTransitions[from][buttonId] ?? 0) + 1;

  const nextHistory = [...state.history, buttonId];
  while (nextHistory.length > PREDICTOR_MAX_HISTORY) nextHistory.shift();

  return {
    lastPressedId: buttonId,
    transitions: nextTransitions,
    history: nextHistory,
  };
}

/**
 * Return up to `topN` button ids ordered by predicted likelihood. If the
 * current-from state has no outgoing transitions yet, fall back to global
 * frequency so we still surface something useful.
 *
 * `excludeIds` lets the caller drop buttons that no longer exist in the
 * active profile (e.g., after a tile delete) so stale history doesn't
 * pollute the Smart Page.
 */
export function predictNextButtons(
  state: PredictorState,
  topN: number = 6,
  excludeIds: ReadonlySet<string> = new Set(),
): string[] {
  if (topN <= 0) return [];
  const from = state.lastPressedId ?? PREDICTOR_START;
  const conditional = state.transitions[from] ?? {};

  const global: Record<string, number> = {};
  for (const row of Object.values(state.transitions)) {
    for (const [to, count] of Object.entries(row)) {
      global[to] = (global[to] ?? 0) + count;
    }
  }

  const score: Record<string, number> = {};
  for (const [to, count] of Object.entries(conditional)) {
    score[to] = count * 2;
  }
  for (const [to, count] of Object.entries(global)) {
    score[to] = (score[to] ?? 0) + count * 0.5;
  }

  return Object.entries(score)
    .filter(([id]) => !excludeIds.has(id))
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([id]) => id);
}

/**
 * Total number of presses recorded. Useful for "not enough data yet" UX
 * copy on the Smart Page.
 */
export function predictorSampleSize(state: PredictorState): number {
  let total = 0;
  for (const row of Object.values(state.transitions)) {
    for (const count of Object.values(row)) {
      total += count;
    }
  }
  return total;
}
