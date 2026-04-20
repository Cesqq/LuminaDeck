/**
 * Macro / automation data model for LuminaDeck.
 * Macros are sequences of steps (actions, delays, loops, conditionals)
 * that can be triggered by buttons, schedules, or webhooks.
 */

import type { Action } from './types';

// --- Step Types ---

export type MacroStepType = 'action' | 'delay' | 'conditional' | 'loop';

export interface MacroStep {
  id: string;
  type: MacroStepType;
}

export interface ActionStep extends MacroStep {
  type: 'action';
  action: Action;
}

export interface DelayStep extends MacroStep {
  type: 'delay';
  /** Delay in milliseconds, clamped to 100–30000. */
  delayMs: number;
}

export interface ConditionalStep extends MacroStep {
  type: 'conditional';
  condition: MacroCondition;
  thenSteps: MacroStep[];
  elseSteps: MacroStep[];
}

export interface LoopStep extends MacroStep {
  type: 'loop';
  /** Iteration count, clamped to 1–100. */
  count: number;
  steps: MacroStep[];
  /** Delay between iterations in milliseconds. */
  delayBetweenMs: number;
}

// --- Conditions ---

export type MacroCondition =
  | WindowActiveCondition
  | TimeRangeCondition;

export interface WindowActiveCondition {
  type: 'window_active';
  processName: string;
}

export interface TimeRangeCondition {
  type: 'time_range';
  /** 0-23 */
  startHour: number;
  /** 0-23 */
  endHour: number;
}

// --- Triggers ---

export type MacroTrigger =
  | { type: 'button' }
  | { type: 'schedule'; cron: string }
  | { type: 'webhook'; path: string };

// --- Macro Config ---

export interface MacroConfig {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  steps: MacroStep[];
  triggers: MacroTrigger[];
  createdAt: string;
  updatedAt: string;
}

// --- Constants ---

export const MACRO_LIMITS = {
  maxSteps: 50,
  maxLoopCount: 100,
  minDelayMs: 100,
  maxDelayMs: 30_000,
  maxNameLength: 40,
  maxDescriptionLength: 200,
  maxNestedDepth: 3,
} as const;
