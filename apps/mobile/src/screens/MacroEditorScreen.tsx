import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import type {
  MacroConfig,
  MacroStep,
  ActionStep,
  DelayStep,
  LoopStep,
  MacroStepType,
  Action,
  ActionType,
  SystemActionName,
} from '@luminadeck/shared';
import { MACRO_LIMITS } from '@luminadeck/shared';
import { useTheme } from '../contexts/ThemeContext';

// --- Helpers ---

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function createStep(type: MacroStepType): MacroStep {
  const id = uid();
  switch (type) {
    case 'action':
      return {
        id,
        type: 'action',
        action: { type: 'keybind', keys: [] },
      } as ActionStep;
    case 'delay':
      return { id, type: 'delay', delayMs: 500 } as DelayStep;
    case 'loop':
      return {
        id,
        type: 'loop',
        count: 2,
        steps: [],
        delayBetweenMs: 200,
      } as LoopStep;
    default:
      return { id, type: 'action', action: { type: 'keybind', keys: [] } } as ActionStep;
  }
}

function stepSummary(step: MacroStep): string {
  switch (step.type) {
    case 'action': {
      const a = (step as ActionStep).action;
      if (!a) return 'Action (empty)';
      switch (a.type) {
        case 'keybind':
          return a.keys.length > 0 ? `Keybind: ${a.keys.join(' + ')}` : 'Keybind (none)';
        case 'system_action':
          return `System: ${a.action.replace(/_/g, ' ')}`;
        case 'app_launch':
          return `Launch: ${a.path.split(/[\\/]/).pop() ?? a.path}`;
        case 'text_input':
          return `Text: "${a.text.slice(0, 20)}"`;
        default:
          return `Action: ${a.type}`;
      }
    }
    case 'delay':
      return `Delay: ${(step as DelayStep).delayMs}ms`;
    case 'loop': {
      const l = step as LoopStep;
      return `Loop x${l.count} (${l.steps.length} step${l.steps.length !== 1 ? 's' : ''})`;
    }
    default:
      return step.type;
  }
}

// --- System actions list (reused from EditorScreen pattern) ---

const SYSTEM_ACTIONS: { value: SystemActionName; label: string }[] = [
  { value: 'volume_up', label: 'Volume Up' },
  { value: 'volume_down', label: 'Volume Down' },
  { value: 'volume_mute', label: 'Mute' },
  { value: 'media_play_pause', label: 'Play/Pause' },
  { value: 'media_next', label: 'Next Track' },
  { value: 'media_prev', label: 'Prev Track' },
  { value: 'media_stop', label: 'Stop' },
  { value: 'screenshot', label: 'Screenshot' },
  { value: 'lock_screen', label: 'Lock' },
  { value: 'sleep', label: 'Sleep' },
  { value: 'brightness_up', label: 'Brightness Up' },
  { value: 'brightness_down', label: 'Brightness Down' },
  { value: 'mic_mute', label: 'Mic Mute' },
];

const ACTION_TYPE_OPTIONS: { value: ActionType; label: string }[] = [
  { value: 'keybind', label: 'Keybind' },
  { value: 'system_action', label: 'System' },
  { value: 'app_launch', label: 'App Launch' },
  { value: 'text_input', label: 'Text Input' },
];

const KEY_SHORTCUTS = [
  'ctrl', 'shift', 'alt', 'win',
  ...'abcdefghijklmnopqrstuvwxyz'.split(''),
  ...'0123456789'.split(''),
  ...(Array.from({ length: 12 }, (_, i) => `f${i + 1}`)),
  'enter', 'tab', 'space', 'backspace', 'delete', 'escape',
  'up', 'down', 'left', 'right',
];

const STEP_TYPE_OPTIONS: { value: MacroStepType; label: string }[] = [
  { value: 'action', label: 'Action' },
  { value: 'delay', label: 'Delay' },
  { value: 'loop', label: 'Loop' },
];

// --- Props ---

interface MacroEditorScreenProps {
  macro?: MacroConfig;
  onSave: (macro: MacroConfig) => void;
  onCancel: () => void;
}

// --- Component ---

export function MacroEditorScreen({
  macro,
  onSave,
  onCancel,
}: MacroEditorScreenProps) {
  const { colors } = useTheme();

  const [name, setName] = useState(macro?.name ?? '');
  const [description, setDescription] = useState(macro?.description ?? '');
  const [steps, setSteps] = useState<MacroStep[]>(macro?.steps ?? []);
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);
  const [showStepPicker, setShowStepPicker] = useState(false);

  const macroId = useMemo(() => macro?.id ?? uid(), [macro?.id]);

  // --- Step CRUD ---

  const addStep = useCallback((type: MacroStepType) => {
    if (steps.length >= MACRO_LIMITS.maxSteps) {
      Alert.alert('Limit Reached', `Maximum of ${MACRO_LIMITS.maxSteps} steps.`);
      return;
    }
    const step = createStep(type);
    setSteps((prev) => [...prev, step]);
    setExpandedStepId(step.id);
    setShowStepPicker(false);
  }, [steps.length]);

  const removeStep = useCallback((id: string) => {
    setSteps((prev) => prev.filter((s) => s.id !== id));
    if (expandedStepId === id) setExpandedStepId(null);
  }, [expandedStepId]);

  const updateStep = useCallback((id: string, updater: (s: MacroStep) => MacroStep) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? updater(s) : s)));
  }, []);

  const moveStep = useCallback((index: number, direction: 'up' | 'down') => {
    setSteps((prev) => {
      const next = [...prev];
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }, []);

  // --- Loop sub-step management ---

  const addLoopSubStep = useCallback((loopId: string, type: MacroStepType) => {
    updateStep(loopId, (s) => {
      const loop = s as LoopStep;
      if (loop.steps.length >= 20) return s;
      return { ...loop, steps: [...loop.steps, createStep(type)] };
    });
  }, [updateStep]);

  const removeLoopSubStep = useCallback((loopId: string, subStepId: string) => {
    updateStep(loopId, (s) => {
      const loop = s as LoopStep;
      return { ...loop, steps: loop.steps.filter((ss) => ss.id !== subStepId) };
    });
  }, [updateStep]);

  // --- Save ---

  const handleSave = useCallback(() => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Name Required', 'Please enter a macro name.');
      return;
    }
    if (trimmedName.length > MACRO_LIMITS.maxNameLength) {
      Alert.alert('Name Too Long', `Maximum ${MACRO_LIMITS.maxNameLength} characters.`);
      return;
    }
    if (steps.length === 0) {
      Alert.alert('No Steps', 'Add at least one step to the macro.');
      return;
    }

    const now = new Date().toISOString();
    const config: MacroConfig = {
      id: macroId,
      name: trimmedName,
      description: description.trim() || undefined,
      steps,
      triggers: macro?.triggers ?? [{ type: 'button' }],
      createdAt: macro?.createdAt ?? now,
      updatedAt: now,
    };
    onSave(config);
  }, [name, description, steps, macroId, macro, onSave]);

  // --- Render helpers ---

  const renderActionEditor = (step: ActionStep, stepId: string, isNested?: boolean) => {
    const action = step.action;
    const actionType = action?.type ?? 'keybind';

    return (
      <View style={isNested ? styles.nestedEditor : undefined}>
        {/* Action type selector */}
        <View style={styles.chipRow}>
          {ACTION_TYPE_OPTIONS.map((opt) => {
            const selected = actionType === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.chip,
                  {
                    backgroundColor: selected ? colors.accent : colors.buttonBackground,
                    borderColor: selected ? colors.accent : colors.buttonBorder,
                  },
                ]}
                onPress={() => {
                  let newAction: Action;
                  switch (opt.value) {
                    case 'keybind':
                      newAction = { type: 'keybind', keys: [] };
                      break;
                    case 'system_action':
                      newAction = { type: 'system_action', action: 'volume_up' };
                      break;
                    case 'app_launch':
                      newAction = { type: 'app_launch', path: '' };
                      break;
                    case 'text_input':
                      newAction = { type: 'text_input', text: '' };
                      break;
                    default:
                      return;
                  }
                  updateStep(stepId, () => ({
                    ...step,
                    action: newAction,
                  }));
                }}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text
                  style={[styles.chipText, { color: selected ? '#FFFFFF' : colors.text }]}
                  allowFontScaling
                  maxFontSizeMultiplier={1.5}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Keybind editor */}
        {actionType === 'keybind' && action.type === 'keybind' && (
          <View style={styles.inlineEditor}>
            <View style={styles.selectedKeysRow}>
              {action.keys.length === 0 ? (
                <Text style={[styles.hint, { color: colors.textSecondary }]}>
                  Tap keys to build combo
                </Text>
              ) : (
                action.keys.map((key, ki) => (
                  <React.Fragment key={key}>
                    {ki > 0 && (
                      <Text style={[styles.plusSign, { color: colors.textSecondary }]}>+</Text>
                    )}
                    <TouchableOpacity
                      style={[styles.keyChip, { backgroundColor: colors.accent }]}
                      onPress={() => {
                        updateStep(stepId, () => ({
                          ...step,
                          action: {
                            ...action,
                            keys: action.keys.filter((k) => k !== key),
                          },
                        }));
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${key}`}
                    >
                      <Text style={styles.keyChipText}>{key.toUpperCase()} x</Text>
                    </TouchableOpacity>
                  </React.Fragment>
                ))
              )}
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.keyScrollContent}
            >
              {KEY_SHORTCUTS.map((key) => {
                const isKeySelected = action.keys.includes(key);
                return (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.miniKey,
                      {
                        backgroundColor: isKeySelected ? colors.accent : colors.background,
                        borderColor: isKeySelected ? colors.accent : colors.buttonBorder,
                      },
                    ]}
                    onPress={() => {
                      const newKeys = isKeySelected
                        ? action.keys.filter((k) => k !== key)
                        : action.keys.length < 6
                          ? [...action.keys, key]
                          : action.keys;
                      updateStep(stepId, () => ({
                        ...step,
                        action: { ...action, keys: newKeys },
                      }));
                    }}
                    accessibilityRole="button"
                  >
                    <Text
                      style={[styles.miniKeyText, { color: isKeySelected ? '#FFFFFF' : colors.text }]}
                      numberOfLines={1}
                    >
                      {key.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* System action picker */}
        {actionType === 'system_action' && action.type === 'system_action' && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.keyScrollContent}
          >
            {SYSTEM_ACTIONS.map(({ value, label }) => {
              const selected = action.action === value;
              return (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.miniKey,
                    {
                      backgroundColor: selected ? colors.accent : colors.background,
                      borderColor: selected ? colors.accent : colors.buttonBorder,
                      paddingHorizontal: 10,
                    },
                  ]}
                  onPress={() => {
                    updateStep(stepId, () => ({
                      ...step,
                      action: { type: 'system_action', action: value },
                    }));
                  }}
                  accessibilityRole="button"
                >
                  <Text
                    style={[styles.miniKeyText, { color: selected ? '#FFFFFF' : colors.text }]}
                    numberOfLines={1}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* App launch path */}
        {actionType === 'app_launch' && action.type === 'app_launch' && (
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: colors.buttonBackground,
                color: colors.text,
                borderColor: colors.buttonBorder,
              },
            ]}
            value={action.path}
            onChangeText={(text) => {
              updateStep(stepId, () => ({
                ...step,
                action: { type: 'app_launch', path: text },
              }));
            }}
            placeholder="C:\Program Files\App\app.exe"
            placeholderTextColor={colors.textSecondary + '88'}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Application path"
          />
        )}

        {/* Text input */}
        {actionType === 'text_input' && action.type === 'text_input' && (
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: colors.buttonBackground,
                color: colors.text,
                borderColor: colors.buttonBorder,
                minHeight: 60,
              },
            ]}
            value={action.text}
            onChangeText={(text) => {
              updateStep(stepId, () => ({
                ...step,
                action: { type: 'text_input', text },
              }));
            }}
            placeholder="Text to type..."
            placeholderTextColor={colors.textSecondary + '88'}
            multiline
            accessibilityLabel="Text to input"
          />
        )}
      </View>
    );
  };

  const renderStepCard = (step: MacroStep, index: number) => {
    const isExpanded = expandedStepId === step.id;

    return (
      <View
        key={step.id}
        style={[
          styles.stepCard,
          {
            backgroundColor: colors.buttonBackground,
            borderColor: colors.buttonBorder,
          },
        ]}
      >
        {/* Step header */}
        <View style={styles.stepHeader}>
          <TouchableOpacity
            style={styles.stepHeaderLeft}
            onPress={() => setExpandedStepId(isExpanded ? null : step.id)}
            accessibilityRole="button"
            accessibilityLabel={`Step ${index + 1}: ${stepSummary(step)}`}
          >
            <Text
              style={[styles.stepIndex, { color: colors.accent }]}
              allowFontScaling
              maxFontSizeMultiplier={1.5}
            >
              #{index + 1}
            </Text>
            <View style={styles.stepInfo}>
              <Text
                style={[styles.stepType, { color: colors.text }]}
                allowFontScaling
                maxFontSizeMultiplier={1.5}
              >
                {step.type.charAt(0).toUpperCase() + step.type.slice(1)}
              </Text>
              <Text
                style={[styles.stepDesc, { color: colors.textSecondary }]}
                numberOfLines={1}
                allowFontScaling
                maxFontSizeMultiplier={1.5}
              >
                {stepSummary(step)}
              </Text>
            </View>
          </TouchableOpacity>

          <View style={styles.stepActions}>
            <TouchableOpacity
              onPress={() => moveStep(index, 'up')}
              disabled={index === 0}
              style={{ opacity: index === 0 ? 0.3 : 1 }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Move up"
            >
              <Text style={[styles.arrow, { color: colors.textSecondary }]}>{'\u25B2'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => moveStep(index, 'down')}
              disabled={index === steps.length - 1}
              style={{ opacity: index === steps.length - 1 ? 0.3 : 1 }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Move down"
            >
              <Text style={[styles.arrow, { color: colors.textSecondary }]}>{'\u25BC'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => removeStep(step.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Remove step"
            >
              <Text style={[styles.removeIcon, { color: colors.statusRed }]}>{'\u00D7'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Expanded editor */}
        {isExpanded && (
          <View style={styles.stepBody}>
            {step.type === 'action' && renderActionEditor(step as ActionStep, step.id)}

            {step.type === 'delay' && (
              <View style={styles.delayEditor}>
                <Text style={[styles.label, { color: colors.text }]}>
                  Delay (ms)
                </Text>
                <TextInput
                  style={[
                    styles.numberInput,
                    {
                      backgroundColor: colors.background,
                      color: colors.text,
                      borderColor: colors.buttonBorder,
                    },
                  ]}
                  value={String((step as DelayStep).delayMs)}
                  onChangeText={(text) => {
                    const num = parseInt(text, 10);
                    if (text === '') {
                      updateStep(step.id, (s) => ({ ...s, delayMs: MACRO_LIMITS.minDelayMs } as DelayStep));
                    } else if (!isNaN(num)) {
                      const clamped = Math.min(Math.max(num, MACRO_LIMITS.minDelayMs), MACRO_LIMITS.maxDelayMs);
                      updateStep(step.id, (s) => ({ ...s, delayMs: clamped } as DelayStep));
                    }
                  }}
                  keyboardType="number-pad"
                  maxLength={5}
                  accessibilityLabel="Delay duration in milliseconds"
                />
                <Text style={[styles.hint, { color: colors.textSecondary }]}>
                  {MACRO_LIMITS.minDelayMs}ms - {MACRO_LIMITS.maxDelayMs / 1000}s
                </Text>
              </View>
            )}

            {step.type === 'loop' && (
              <View style={styles.loopEditor}>
                <View style={styles.loopRow}>
                  <Text style={[styles.label, { color: colors.text }]}>Repeat</Text>
                  <TextInput
                    style={[
                      styles.numberInput,
                      {
                        backgroundColor: colors.background,
                        color: colors.text,
                        borderColor: colors.buttonBorder,
                      },
                    ]}
                    value={String((step as LoopStep).count)}
                    onChangeText={(text) => {
                      const num = parseInt(text, 10);
                      if (text === '') {
                        updateStep(step.id, (s) => ({ ...s, count: 1 } as LoopStep));
                      } else if (!isNaN(num)) {
                        const clamped = Math.min(Math.max(num, 1), MACRO_LIMITS.maxLoopCount);
                        updateStep(step.id, (s) => ({ ...s, count: clamped } as LoopStep));
                      }
                    }}
                    keyboardType="number-pad"
                    maxLength={3}
                    accessibilityLabel="Loop count"
                  />
                  <Text style={[styles.label, { color: colors.text }]}>times</Text>
                </View>

                <View style={styles.loopRow}>
                  <Text style={[styles.label, { color: colors.text }]}>Delay between</Text>
                  <TextInput
                    style={[
                      styles.numberInput,
                      {
                        backgroundColor: colors.background,
                        color: colors.text,
                        borderColor: colors.buttonBorder,
                      },
                    ]}
                    value={String((step as LoopStep).delayBetweenMs)}
                    onChangeText={(text) => {
                      const num = parseInt(text, 10);
                      if (text === '') {
                        updateStep(step.id, (s) => ({ ...s, delayBetweenMs: 0 } as LoopStep));
                      } else if (!isNaN(num)) {
                        const clamped = Math.min(Math.max(num, 0), MACRO_LIMITS.maxDelayMs);
                        updateStep(step.id, (s) => ({ ...s, delayBetweenMs: clamped } as LoopStep));
                      }
                    }}
                    keyboardType="number-pad"
                    maxLength={5}
                    accessibilityLabel="Delay between loop iterations"
                  />
                  <Text style={[styles.label, { color: colors.textSecondary }]}>ms</Text>
                </View>

                {/* Nested sub-steps */}
                <Text
                  style={[styles.sectionLabel, { color: colors.text }]}
                  allowFontScaling
                  maxFontSizeMultiplier={1.5}
                >
                  Loop Steps ({(step as LoopStep).steps.length})
                </Text>

                {(step as LoopStep).steps.map((subStep, si) => (
                  <View
                    key={subStep.id}
                    style={[
                      styles.nestedStepCard,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.buttonBorder,
                      },
                    ]}
                  >
                    <View style={styles.nestedHeader}>
                      <Text
                        style={[styles.stepIndex, { color: colors.accent }]}
                        allowFontScaling
                        maxFontSizeMultiplier={1.5}
                      >
                        {index + 1}.{si + 1}
                      </Text>
                      <Text
                        style={[styles.stepDesc, { color: colors.textSecondary, flex: 1 }]}
                        numberOfLines={1}
                      >
                        {stepSummary(subStep)}
                      </Text>
                      <TouchableOpacity
                        onPress={() => removeLoopSubStep(step.id, subStep.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityRole="button"
                        accessibilityLabel="Remove loop sub-step"
                      >
                        <Text style={[styles.removeIcon, { color: colors.statusRed }]}>{'\u00D7'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}

                {(step as LoopStep).steps.length < 20 && (
                  <View style={styles.chipRow}>
                    {(['action', 'delay'] as const).map((t) => (
                      <TouchableOpacity
                        key={t}
                        style={[styles.addChip, { borderColor: colors.accent }]}
                        onPress={() => addLoopSubStep(step.id, t)}
                        accessibilityRole="button"
                        accessibilityLabel={`Add ${t} to loop`}
                      >
                        <Text
                          style={[styles.addChipText, { color: colors.accent }]}
                          allowFontScaling
                          maxFontSizeMultiplier={1.5}
                        >
                          + {t.charAt(0).toUpperCase() + t.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text
            style={[styles.headerAction, { color: colors.textSecondary }]}
            allowFontScaling
            maxFontSizeMultiplier={1.5}
          >
            Cancel
          </Text>
        </TouchableOpacity>
        <Text
          style={[styles.headerTitle, { color: colors.text }]}
          allowFontScaling
          maxFontSizeMultiplier={1.5}
        >
          {macro ? 'Edit Macro' : 'New Macro'}
        </Text>
        <TouchableOpacity
          onPress={handleSave}
          accessibilityRole="button"
          accessibilityLabel="Save macro"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text
            style={[styles.headerAction, { color: colors.accent, fontWeight: '700' }]}
            allowFontScaling
            maxFontSizeMultiplier={1.5}
          >
            Save
          </Text>
        </TouchableOpacity>
      </View>

      {/* Name */}
      <View style={styles.section}>
        <Text
          style={[styles.sectionTitle, { color: colors.text }]}
          allowFontScaling
          maxFontSizeMultiplier={1.5}
        >
          Name
        </Text>
        <TextInput
          style={[
            styles.textInput,
            {
              backgroundColor: colors.buttonBackground,
              color: colors.text,
              borderColor: colors.buttonBorder,
            },
          ]}
          value={name}
          onChangeText={(text) => setName(text.slice(0, MACRO_LIMITS.maxNameLength))}
          placeholder="Macro name"
          placeholderTextColor={colors.textSecondary + '88'}
          maxLength={MACRO_LIMITS.maxNameLength}
          accessibilityLabel="Macro name"
          allowFontScaling
          maxFontSizeMultiplier={1.5}
        />
        <Text
          style={[styles.charCount, { color: colors.textSecondary }]}
          allowFontScaling
          maxFontSizeMultiplier={1.5}
        >
          {name.length}/{MACRO_LIMITS.maxNameLength}
        </Text>
      </View>

      {/* Description */}
      <View style={styles.section}>
        <Text
          style={[styles.sectionTitle, { color: colors.text }]}
          allowFontScaling
          maxFontSizeMultiplier={1.5}
        >
          Description (optional)
        </Text>
        <TextInput
          style={[
            styles.textInput,
            {
              backgroundColor: colors.buttonBackground,
              color: colors.text,
              borderColor: colors.buttonBorder,
              minHeight: 50,
            },
          ]}
          value={description}
          onChangeText={(text) => setDescription(text.slice(0, MACRO_LIMITS.maxDescriptionLength))}
          placeholder="What does this macro do?"
          placeholderTextColor={colors.textSecondary + '88'}
          maxLength={MACRO_LIMITS.maxDescriptionLength}
          multiline
          accessibilityLabel="Macro description"
          allowFontScaling
          maxFontSizeMultiplier={1.5}
        />
      </View>

      {/* Steps */}
      <View style={styles.section}>
        <Text
          style={[styles.sectionTitle, { color: colors.text }]}
          allowFontScaling
          maxFontSizeMultiplier={1.5}
        >
          Steps ({steps.length}/{MACRO_LIMITS.maxSteps})
        </Text>

        {steps.length === 0 && (
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: colors.buttonBackground, borderColor: colors.buttonBorder },
            ]}
          >
            <Text
              style={[styles.emptyText, { color: colors.textSecondary }]}
              allowFontScaling
              maxFontSizeMultiplier={1.5}
            >
              No steps yet. Tap "Add Step" to start building your macro.
            </Text>
          </View>
        )}

        {steps.map((step, index) => renderStepCard(step, index))}

        {/* Add Step */}
        {steps.length < MACRO_LIMITS.maxSteps && (
          <>
            {showStepPicker ? (
              <View style={styles.stepPickerRow}>
                {STEP_TYPE_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.stepPickerChip, { backgroundColor: colors.accent }]}
                    onPress={() => addStep(opt.value)}
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${opt.label} step`}
                  >
                    <Text style={styles.stepPickerText}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[styles.stepPickerChip, { backgroundColor: colors.buttonBackground, borderWidth: 1, borderColor: colors.buttonBorder }]}
                  onPress={() => setShowStepPicker(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel add step"
                >
                  <Text style={[styles.stepPickerText, { color: colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.addStepButton, { borderColor: colors.accent }]}
                onPress={() => setShowStepPicker(true)}
                accessibilityRole="button"
                accessibilityLabel="Add step"
              >
                <Text
                  style={[styles.addStepText, { color: colors.accent }]}
                  allowFontScaling
                  maxFontSizeMultiplier={1.5}
                >
                  + Add Step
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>

      {/* Bottom action bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.cancelBtn, { borderColor: colors.buttonBorder }]}
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
        >
          <Text
            style={[styles.cancelBtnText, { color: colors.textSecondary }]}
            allowFontScaling
            maxFontSizeMultiplier={1.5}
          >
            Cancel
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: colors.accent }]}
          onPress={handleSave}
          accessibilityRole="button"
          accessibilityLabel="Save macro"
        >
          <Text
            style={styles.saveBtnText}
            allowFontScaling
            maxFontSizeMultiplier={1.5}
          >
            Save Macro
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// --- Styles ---

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 60,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  headerAction: {
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  charCount: {
    fontSize: 11,
    textAlign: 'right',
    marginTop: 4,
  },
  numberInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
    width: 72,
    textAlign: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
  },
  hint: {
    fontSize: 12,
    marginTop: 4,
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 20,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },

  // --- Step cards ---
  stepCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepIndex: {
    fontSize: 14,
    fontWeight: '800',
  },
  stepInfo: {
    flex: 1,
  },
  stepType: {
    fontSize: 13,
    fontWeight: '700',
  },
  stepDesc: {
    fontSize: 12,
    marginTop: 1,
  },
  stepActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  arrow: {
    fontSize: 14,
    fontWeight: '700',
  },
  removeIcon: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 22,
  },
  stepBody: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },

  // --- Inline editors ---
  inlineEditor: {
    marginTop: 8,
  },
  nestedEditor: {
    marginTop: 4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  selectedKeysRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    minHeight: 32,
    gap: 4,
    marginBottom: 8,
  },
  keyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  keyChipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  plusSign: {
    fontSize: 14,
    fontWeight: '700',
    marginHorizontal: 2,
  },
  keyScrollContent: {
    gap: 4,
    paddingVertical: 4,
  },
  miniKey: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    minWidth: 36,
    alignItems: 'center',
  },
  miniKeyText: {
    fontSize: 10,
    fontWeight: '600',
  },

  // --- Delay editor ---
  delayEditor: {
    gap: 6,
  },

  // --- Loop editor ---
  loopEditor: {
    gap: 6,
  },
  loopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nestedStepCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    marginBottom: 6,
  },
  nestedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addChip: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addChipText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // --- Step type picker ---
  stepPickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  stepPickerChip: {
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  stepPickerText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  addStepButton: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  addStepText: {
    fontSize: 14,
    fontWeight: '700',
  },

  // --- Bottom bar ---
  bottomBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
