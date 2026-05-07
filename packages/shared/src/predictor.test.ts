import { describe, it, expect } from 'vitest';
import {
  createEmptyPredictorState,
  normalisePredictorState,
  recordPredictorPress,
  predictNextButtons,
  predictorSampleSize,
  PREDICTOR_MAX_HISTORY,
  PREDICTOR_START,
} from './predictor';

describe('Predictor state', () => {
  it('starts empty', () => {
    const state = createEmptyPredictorState();
    expect(state.lastPressedId).toBeNull();
    expect(state.transitions).toEqual({});
    expect(state.history).toEqual([]);
    expect(predictorSampleSize(state)).toBe(0);
  });

  it('records a single press under the start marker', () => {
    let state = createEmptyPredictorState();
    state = recordPredictorPress(state, 'A');
    expect(state.lastPressedId).toBe('A');
    expect(state.transitions[PREDICTOR_START]?.A).toBe(1);
    expect(state.history).toEqual(['A']);
  });

  it('records transitions between presses', () => {
    let state = createEmptyPredictorState();
    state = recordPredictorPress(state, 'A');
    state = recordPredictorPress(state, 'B');
    state = recordPredictorPress(state, 'A');
    expect(state.transitions.A?.B).toBe(1);
    expect(state.transitions.B?.A).toBe(1);
    expect(predictorSampleSize(state)).toBe(3);
  });

  it('treats the input state as immutable', () => {
    const state = createEmptyPredictorState();
    const next = recordPredictorPress(state, 'A');
    expect(state).not.toBe(next);
    expect(state.history).toEqual([]);
  });

  it('caps history at PREDICTOR_MAX_HISTORY', () => {
    let state = createEmptyPredictorState();
    for (let i = 0; i < PREDICTOR_MAX_HISTORY + 25; i++) {
      state = recordPredictorPress(state, `btn-${i}`);
    }
    expect(state.history.length).toBe(PREDICTOR_MAX_HISTORY);
    expect(state.history[0]).toBe(`btn-25`);
  });
});

describe('Predictor predictions', () => {
  it('returns empty for an empty state', () => {
    expect(predictNextButtons(createEmptyPredictorState())).toEqual([]);
  });

  it('prefers the conditional next button over global frequency', () => {
    let state = createEmptyPredictorState();
    // Sequence: A B A B A B — from B, A should be the top prediction.
    for (let i = 0; i < 6; i++) {
      state = recordPredictorPress(state, i % 2 === 0 ? 'A' : 'B');
    }
    // lastPressedId ends on 'B' after 6 iterations (0..5, last is i=5 odd → B)
    expect(state.lastPressedId).toBe('B');
    const predictions = predictNextButtons(state, 2);
    expect(predictions[0]).toBe('A');
  });

  it('falls back to global frequency when the current state is unseen', () => {
    let state = createEmptyPredictorState();
    state = recordPredictorPress(state, 'A');
    state = recordPredictorPress(state, 'A');
    state = recordPredictorPress(state, 'A');
    // Force the lastPressedId to something not seen as a "from" key.
    state = { ...state, lastPressedId: 'never-seen' };
    const predictions = predictNextButtons(state, 3);
    expect(predictions).toContain('A');
  });

  it('excludes ids on the excludeIds set', () => {
    let state = createEmptyPredictorState();
    state = recordPredictorPress(state, 'A');
    state = recordPredictorPress(state, 'B');
    state = recordPredictorPress(state, 'C');
    const predictions = predictNextButtons(state, 3, new Set(['A']));
    expect(predictions).not.toContain('A');
  });

  it('caps output at topN', () => {
    let state = createEmptyPredictorState();
    for (const id of ['A', 'B', 'C', 'D', 'E']) {
      state = recordPredictorPress(state, id);
    }
    expect(predictNextButtons(state, 2).length).toBeLessThanOrEqual(2);
  });
});

describe('Predictor normaliseState', () => {
  it('returns an empty state for malformed input', () => {
    expect(normalisePredictorState(null)).toEqual(createEmptyPredictorState());
    expect(normalisePredictorState('garbage')).toEqual(createEmptyPredictorState());
    expect(normalisePredictorState({ transitions: 'not an object' })).toEqual(createEmptyPredictorState());
  });

  it('drops negative / NaN transition counts', () => {
    const normalised = normalisePredictorState({
      lastPressedId: 'A',
      transitions: {
        A: { B: 3, C: -1, D: Number.NaN, E: 'oops' },
      },
      history: ['A', 'B', 42, 'C'],
    });
    expect(normalised.transitions.A).toEqual({ B: 3 });
    expect(normalised.history).toEqual(['A', 'B', 'C']);
  });

  it('trims history to the cap when the stored value exceeds it', () => {
    const longHistory = Array.from({ length: PREDICTOR_MAX_HISTORY + 50 }, (_, i) => `btn-${i}`);
    const normalised = normalisePredictorState({
      lastPressedId: longHistory.at(-1),
      transitions: {},
      history: longHistory,
    });
    expect(normalised.history.length).toBe(PREDICTOR_MAX_HISTORY);
    expect(normalised.history[0]).toBe(`btn-50`);
  });
});
