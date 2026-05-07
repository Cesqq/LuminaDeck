/**
 * AsyncStorage-backed wrapper around the shared pure Markov predictor.
 *
 * Storage is keyed per profile so switching profiles doesn't mix learned
 * patterns. Writes are fire-and-forget — a press should never be slowed by
 * disk IO, and a lost write only loses that single transition.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createEmptyPredictorState,
  normalisePredictorState,
  predictNextButtons,
  predictorSampleSize,
  recordPredictorPress,
  type PredictorState,
} from '@luminadeck/shared';

const STORAGE_PREFIX = '@luminadeck/predictor/';

let enabled = false;
let currentProfileId: string | null = null;
let state: PredictorState = createEmptyPredictorState();

function storageKey(profileId: string): string {
  return STORAGE_PREFIX + profileId;
}

async function loadForProfile(profileId: string): Promise<PredictorState> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(profileId));
    if (!raw) return createEmptyPredictorState();
    const parsed = JSON.parse(raw);
    return normalisePredictorState(parsed);
  } catch {
    return createEmptyPredictorState();
  }
}

function persist(): void {
  if (!currentProfileId) return;
  const profileId = currentProfileId;
  // Serialise a snapshot so concurrent recordPress calls can't trip on a
  // structure mutated mid-stringify.
  const snapshot = state;
  AsyncStorage.setItem(storageKey(profileId), JSON.stringify(snapshot)).catch(() => {
    // Telemetry-style silent failure: a lost write only costs one sample.
  });
}

export async function initPredictor(opts: {
  enabled: boolean;
  profileId: string | null;
}): Promise<void> {
  enabled = opts.enabled;
  currentProfileId = opts.profileId;
  state = currentProfileId ? await loadForProfile(currentProfileId) : createEmptyPredictorState();
}

export function setPredictorEnabled(value: boolean): void {
  enabled = value;
}

export function isPredictorEnabled(): boolean {
  return enabled;
}

export async function setCurrentProfileId(profileId: string | null): Promise<void> {
  if (profileId === currentProfileId) return;
  currentProfileId = profileId;
  state = profileId ? await loadForProfile(profileId) : createEmptyPredictorState();
}

export function recordButtonPress(buttonId: string): void {
  if (!enabled || !currentProfileId) return;
  state = recordPredictorPress(state, buttonId);
  persist();
}

export function predictButtons(topN: number = 6, excludeIds?: ReadonlySet<string>): string[] {
  if (!currentProfileId) return [];
  return predictNextButtons(state, topN, excludeIds ?? new Set());
}

export function getSampleSize(): number {
  return predictorSampleSize(state);
}
