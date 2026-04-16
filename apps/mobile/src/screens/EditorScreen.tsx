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
  ButtonConfig,
  Action,
  ActionType,
  KeybindAction,
  AppLaunchAction,
  SystemAction,
  SystemActionName,
  MultiAction,
} from '@luminadeck/shared';
import { VALID_KEYS, MODIFIER_KEYS } from '@luminadeck/shared';
import { useTheme } from '../contexts/ThemeContext';
import { usePro } from '../contexts/ProContext';
import { pickButtonImage } from '../lib/imagePicker';
import { ICON_CATEGORIES, getIconsByCategory, getAllIcons, type IconCategory } from '../lib/icons';
import { IconView } from '../components/IconView';

// --- Key categories for the picker ---

const KEY_CATEGORIES: { name: string; keys: string[] }[] = [
  {
    name: 'Modifiers',
    keys: ['ctrl', 'shift', 'alt', 'win'],
  },
  {
    name: 'Letters',
    keys: 'abcdefghijklmnopqrstuvwxyz'.split(''),
  },
  {
    name: 'Numbers',
    keys: '0123456789'.split(''),
  },
  {
    name: 'Function',
    keys: Array.from({ length: 12 }, (_, i) => `f${i + 1}`),
  },
  {
    name: 'Navigation',
    keys: ['up', 'down', 'left', 'right', 'home', 'end', 'pageup', 'pagedown'],
  },
  {
    name: 'Editing',
    keys: ['enter', 'tab', 'space', 'backspace', 'delete', 'escape', 'insert'],
  },
  {
    name: 'Media',
    keys: [
      'media_play_pause', 'media_next', 'media_prev', 'media_stop',
      'volume_up', 'volume_down', 'volume_mute',
    ],
  },
  {
    name: 'Punctuation',
    keys: [
      'minus', 'equals', 'leftbracket', 'rightbracket',
      'backslash', 'semicolon', 'quote', 'comma', 'period', 'slash', 'backtick',
    ],
  },
];

const SYSTEM_ACTIONS: { value: SystemActionName; label: string }[] = [
  { value: 'volume_up', label: 'Volume Up' },
  { value: 'volume_down', label: 'Volume Down' },
  { value: 'volume_mute', label: 'Volume Mute' },
  { value: 'media_play_pause', label: 'Play / Pause' },
  { value: 'media_next', label: 'Next Track' },
  { value: 'media_prev', label: 'Previous Track' },
  { value: 'media_stop', label: 'Stop Media' },
  { value: 'screenshot', label: 'Screenshot' },
  { value: 'lock_screen', label: 'Lock Screen' },
  { value: 'sleep', label: 'Sleep' },
  { value: 'brightness_up', label: 'Brightness Up' },
  { value: 'brightness_down', label: 'Brightness Down' },
  { value: 'mic_mute', label: 'Mic Mute' },
];

const ACTION_TYPES: { value: ActionType; label: string; proOnly: boolean }[] = [
  { value: 'keybind', label: 'Keybind', proOnly: false },
  { value: 'app_launch', label: 'App Launch', proOnly: false },
  { value: 'system_action', label: 'System', proOnly: false },
  { value: 'multi_action', label: 'Multi-Action', proOnly: true },
];

const PALETTE_COLORS = [
  '#1A1A2E', '#16213E', '#0F3460', '#533483', '#7B2FBE',
  '#E94560', '#FF006E', '#00D4FF', '#00FF88', '#FFD600',
  '#4CAF50', '#2196F3', '#FF5722', '#9C27B0', '#607D8B',
];

type SubActionType = 'keybind' | 'app_launch' | 'system_action';

interface SubAction {
  id: string;
  type: SubActionType;
  keys: string[];
  appPath: string;
  systemAction: SystemActionName;
  delay: number; // ms before next action
}

function createSubAction(): SubAction {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    type: 'keybind',
    keys: [],
    appPath: '',
    systemAction: 'volume_up',
    delay: 0,
  };
}

function initSubActionsFromButton(button: ButtonConfig): SubAction[] {
  if (button.action?.type !== 'multi_action') return [];
  const ma = button.action as MultiAction;
  return ma.actions.map((a, i) => {
    const base = createSubAction();
    base.type = a.type;
    if (a.type === 'keybind') base.keys = [...a.keys];
    if (a.type === 'app_launch') base.appPath = a.path;
    if (a.type === 'system_action') base.systemAction = a.action;
    base.delay = ma.delays?.[i] ?? 0;
    return base;
  });
}

const MAX_SUB_ACTIONS = 10;
const MAX_DELAY_MS = 5000;

interface EditorScreenProps {
  button: ButtonConfig;
  pageIndex: number;
  onSave: (updated: ButtonConfig) => void;
  onCancel: () => void;
}

export function EditorScreen({
  button,
  pageIndex,
  onSave,
  onCancel,
}: EditorScreenProps) {
  const { colors } = useTheme();
  const { isPro } = usePro();

  const [actionType, setActionType] = useState<ActionType>(
    button.action?.type ?? 'keybind',
  );
  const [label, setLabel] = useState(button.label ?? '');
  const [selectedColor, setSelectedColor] = useState(button.color ?? colors.buttonBackground);

  // Keybind state
  const [selectedKeys, setSelectedKeys] = useState<string[]>(
    button.action?.type === 'keybind' ? button.action.keys : [],
  );
  const [activeCategory, setActiveCategory] = useState(0);

  // App launch state
  const [appPath, setAppPath] = useState(
    button.action?.type === 'app_launch' ? button.action.path : '',
  );

  // System action state
  const [systemAction, setSystemAction] = useState<SystemActionName>(
    button.action?.type === 'system_action' ? button.action.action : 'volume_up',
  );

  // Icon state
  const [selectedIcon, setSelectedIcon] = useState<string | undefined>(button.icon);
  const [iconCategory, setIconCategory] = useState<IconCategory>('system');

  // Multi-action state
  const [subActions, setSubActions] = useState<SubAction[]>(
    () => initSubActionsFromButton(button),
  );

  // Custom image state
  const [customImage, setCustomImage] = useState<string | undefined>(button.customImage);

  const addSubAction = useCallback(() => {
    setSubActions((prev) => {
      if (prev.length >= MAX_SUB_ACTIONS) return prev;
      return [...prev, createSubAction()];
    });
  }, []);

  const removeSubAction = useCallback((id: string) => {
    setSubActions((prev) => prev.filter((sa) => sa.id !== id));
  }, []);

  const updateSubAction = useCallback((id: string, updates: Partial<SubAction>) => {
    setSubActions((prev) =>
      prev.map((sa) => (sa.id === id ? { ...sa, ...updates } : sa)),
    );
  }, []);

  const moveSubAction = useCallback((index: number, direction: 'up' | 'down') => {
    setSubActions((prev) => {
      const next = [...prev];
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }, []);

  const toggleKey = useCallback(
    (key: string) => {
      setSelectedKeys((prev) => {
        if (prev.includes(key)) {
          return prev.filter((k) => k !== key);
        }
        if (prev.length >= 6) {
          return prev;
        }
        return [...prev, key];
      });
    },
    [],
  );

  const removeKey = useCallback((key: string) => {
    setSelectedKeys((prev) => prev.filter((k) => k !== key));
  }, []);

  const builtAction = useMemo((): Action | null => {
    switch (actionType) {
      case 'keybind':
        if (selectedKeys.length === 0) return null;
        return { type: 'keybind', keys: selectedKeys };
      case 'app_launch':
        if (!appPath.trim()) return null;
        return { type: 'app_launch', path: appPath.trim() };
      case 'system_action':
        return { type: 'system_action', action: systemAction };
      case 'multi_action': {
        if (subActions.length === 0) return null;
        const actions: (KeybindAction | AppLaunchAction | SystemAction)[] = [];
        for (const sa of subActions) {
          switch (sa.type) {
            case 'keybind':
              if (sa.keys.length === 0) return null;
              actions.push({ type: 'keybind', keys: sa.keys });
              break;
            case 'app_launch':
              if (!sa.appPath.trim()) return null;
              actions.push({ type: 'app_launch', path: sa.appPath.trim() });
              break;
            case 'system_action':
              actions.push({ type: 'system_action', action: sa.systemAction });
              break;
          }
        }
        const delays = subActions.map((sa) => sa.delay);
        return { type: 'multi_action', actions, delays };
      }
      default:
        return null;
    }
  }, [actionType, selectedKeys, appPath, systemAction, subActions]);

  const handleSave = useCallback(() => {
    if (label.length > 16) {
      Alert.alert('Label too long', 'Button labels must be 16 characters or fewer.');
      return;
    }

    const updated: ButtonConfig = {
      ...button,
      action: builtAction,
      label: label.trim() || undefined,
      icon: selectedIcon,
      color: selectedColor,
      customImage,
    };

    onSave(updated);
  }, [button, builtAction, label, selectedIcon, selectedColor, customImage, onSave]);

  const handleImagePicker = useCallback(async () => {
    if (!isPro) {
      Alert.alert('Pro Feature', 'Custom button images require LuminaDeck Pro.');
      return;
    }
    try {
      const uri = await pickButtonImage();
      if (uri) {
        setCustomImage(uri);
      } else {
        // null means cancelled or permission denied — check which one
        const { requestImagePermission } = await import('../lib/imagePicker');
        const granted = await requestImagePermission();
        if (!granted) {
          Alert.alert(
            'Permission Required',
            'Please allow photo library access in Settings to choose a custom image.',
          );
        }
      }
    } catch {
      Alert.alert('Error', 'Could not open the image picker. Please try again.');
    }
  }, [isPro]);

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
          accessibilityLabel="Cancel editing"
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
          Edit Button
        </Text>
        <TouchableOpacity
          onPress={handleSave}
          accessibilityRole="button"
          accessibilityLabel="Save button"
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

      {/* Preview */}
      <View style={styles.previewSection}>
        <View
          style={[
            styles.previewButton,
            {
              backgroundColor: selectedColor,
              borderColor: colors.buttonBorder,
            },
          ]}
          accessibilityRole="image"
          accessibilityLabel={`Button preview: ${label || 'Untitled'}`}
        >
          {selectedIcon ? (
            <IconView name={selectedIcon} size={28} color={colors.accent} />
          ) : (
            <Text
              style={[styles.previewIcon, { color: colors.accent }]}
              allowFontScaling
              maxFontSizeMultiplier={1.5}
            >
              {label?.charAt(0)?.toUpperCase() ?? '?'}
            </Text>
          )}
          {label ? (
            <Text
              style={[styles.previewLabel, { color: colors.text }]}
              numberOfLines={1}
              allowFontScaling
              maxFontSizeMultiplier={1.5}
            >
              {label}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Label */}
      <View style={styles.section}>
        <Text
          style={[styles.sectionTitle, { color: colors.text }]}
          allowFontScaling
          maxFontSizeMultiplier={1.5}
        >
          Label
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
          value={label}
          onChangeText={(text) => setLabel(text.slice(0, 16))}
          placeholder="Button label (max 16 chars)"
          placeholderTextColor={colors.textSecondary + '88'}
          maxLength={16}
          accessibilityLabel="Button label input"
          allowFontScaling
          maxFontSizeMultiplier={1.5}
        />
        <Text
          style={[styles.charCount, { color: colors.textSecondary }]}
          allowFontScaling
          maxFontSizeMultiplier={1.5}
        >
          {label.length}/16
        </Text>
      </View>

      {/* Action Type Picker */}
      <View style={styles.section}>
        <Text
          style={[styles.sectionTitle, { color: colors.text }]}
          allowFontScaling
          maxFontSizeMultiplier={1.5}
        >
          Action Type
        </Text>
        <View style={styles.actionTypeRow}>
          {ACTION_TYPES.map(({ value, label: typeLabel, proOnly }) => {
            const disabled = proOnly && !isPro;
            const isSelected = actionType === value;

            return (
              <TouchableOpacity
                key={value}
                style={[
                  styles.actionTypeChip,
                  {
                    backgroundColor: isSelected ? colors.accent : colors.buttonBackground,
                    borderColor: isSelected ? colors.accent : colors.buttonBorder,
                    opacity: disabled ? 0.4 : 1,
                  },
                ]}
                onPress={() => {
                  if (disabled) {
                    Alert.alert('Pro Feature', 'Multi-Action requires LuminaDeck Pro.');
                    return;
                  }
                  setActionType(value);
                }}
                disabled={false}
                accessibilityRole="button"
                accessibilityLabel={`${typeLabel} action type${isSelected ? ', selected' : ''}${disabled ? ', requires Pro' : ''}`}
                accessibilityState={{ selected: isSelected }}
              >
                <Text
                  style={[
                    styles.actionTypeText,
                    { color: isSelected ? '#FFFFFF' : colors.text },
                  ]}
                  allowFontScaling
                  maxFontSizeMultiplier={1.5}
                >
                  {typeLabel}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Action-specific builder */}
      {actionType === 'keybind' && (
        <View style={styles.section}>
          <Text
            style={[styles.sectionTitle, { color: colors.text }]}
            allowFontScaling
            maxFontSizeMultiplier={1.5}
          >
            Key Combo
          </Text>

          {/* Selected keys display */}
          <View style={styles.selectedKeysRow}>
            {selectedKeys.length === 0 ? (
              <Text
                style={[styles.placeholderText, { color: colors.textSecondary }]}
                allowFontScaling
                maxFontSizeMultiplier={1.5}
              >
                Tap keys below to build a combo
              </Text>
            ) : (
              selectedKeys.map((key, index) => (
                <React.Fragment key={key}>
                  {index > 0 && (
                    <Text
                      style={[styles.plusSign, { color: colors.textSecondary }]}
                      allowFontScaling
                      maxFontSizeMultiplier={1.5}
                    >
                      +
                    </Text>
                  )}
                  <TouchableOpacity
                    style={[styles.selectedKeyChip, { backgroundColor: colors.accent }]}
                    onPress={() => removeKey(key)}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${key} key`}
                  >
                    <Text
                      style={styles.selectedKeyText}
                      allowFontScaling
                      maxFontSizeMultiplier={1.5}
                    >
                      {key.toUpperCase()}
                    </Text>
                    <Text
                      style={styles.removeKeyIcon}
                      allowFontScaling
                      maxFontSizeMultiplier={1.5}
                    >
                      {' \u00D7'}
                    </Text>
                  </TouchableOpacity>
                </React.Fragment>
              ))
            )}
          </View>

          {/* Category tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryScroll}
            contentContainerStyle={styles.categoryContent}
          >
            {KEY_CATEGORIES.map((cat, index) => (
              <TouchableOpacity
                key={cat.name}
                style={[
                  styles.categoryTab,
                  {
                    backgroundColor:
                      activeCategory === index ? colors.accent + '33' : 'transparent',
                    borderBottomColor:
                      activeCategory === index ? colors.accent : 'transparent',
                  },
                ]}
                onPress={() => setActiveCategory(index)}
                accessibilityRole="tab"
                accessibilityLabel={`${cat.name} keys category`}
                accessibilityState={{ selected: activeCategory === index }}
              >
                <Text
                  style={[
                    styles.categoryTabText,
                    {
                      color:
                        activeCategory === index ? colors.accent : colors.textSecondary,
                    },
                  ]}
                  allowFontScaling
                  maxFontSizeMultiplier={1.5}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Keys grid */}
          <View style={styles.keysGrid}>
            {KEY_CATEGORIES[activeCategory]?.keys.map((key) => {
              const isSelected = selectedKeys.includes(key);
              return (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.keyButton,
                    {
                      backgroundColor: isSelected
                        ? colors.accent
                        : colors.buttonBackground,
                      borderColor: isSelected ? colors.accent : colors.buttonBorder,
                    },
                  ]}
                  onPress={() => toggleKey(key)}
                  accessibilityRole="button"
                  accessibilityLabel={`${key} key${isSelected ? ', selected' : ''}`}
                  accessibilityState={{ selected: isSelected }}
                >
                  <Text
                    style={[
                      styles.keyButtonText,
                      { color: isSelected ? '#FFFFFF' : colors.text },
                    ]}
                    allowFontScaling
                    maxFontSizeMultiplier={1.5}
                    numberOfLines={1}
                  >
                    {key.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {actionType === 'app_launch' && (
        <View style={styles.section}>
          <Text
            style={[styles.sectionTitle, { color: colors.text }]}
            allowFontScaling
            maxFontSizeMultiplier={1.5}
          >
            Application Path
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
            value={appPath}
            onChangeText={setAppPath}
            placeholder='C:\\Program Files\\App\\app.exe'
            placeholderTextColor={colors.textSecondary + '88'}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Application executable path"
            allowFontScaling
            maxFontSizeMultiplier={1.5}
          />
          <Text
            style={[styles.hintText, { color: colors.textSecondary }]}
            allowFontScaling
            maxFontSizeMultiplier={1.5}
          >
            Enter the full path to the executable on your Windows PC.
          </Text>
        </View>
      )}

      {actionType === 'system_action' && (
        <View style={styles.section}>
          <Text
            style={[styles.sectionTitle, { color: colors.text }]}
            allowFontScaling
            maxFontSizeMultiplier={1.5}
          >
            System Action
          </Text>
          <View style={styles.systemActionsGrid}>
            {SYSTEM_ACTIONS.map(({ value, label: actionLabel }) => {
              const isSelected = systemAction === value;
              return (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.systemActionChip,
                    {
                      backgroundColor: isSelected
                        ? colors.accent
                        : colors.buttonBackground,
                      borderColor: isSelected ? colors.accent : colors.buttonBorder,
                    },
                  ]}
                  onPress={() => setSystemAction(value)}
                  accessibilityRole="button"
                  accessibilityLabel={`${actionLabel} system action${isSelected ? ', selected' : ''}`}
                  accessibilityState={{ selected: isSelected }}
                >
                  <Text
                    style={[
                      styles.systemActionText,
                      { color: isSelected ? '#FFFFFF' : colors.text },
                    ]}
                    allowFontScaling
                    maxFontSizeMultiplier={1.5}
                    numberOfLines={1}
                  >
                    {actionLabel}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {actionType === 'multi_action' && (
        <View style={styles.section}>
          <Text
            style={[styles.sectionTitle, { color: colors.text }]}
            allowFontScaling
            maxFontSizeMultiplier={1.5}
          >
            Sub-Actions ({subActions.length}/{MAX_SUB_ACTIONS})
          </Text>

          {subActions.length === 0 && (
            <View
              style={[styles.placeholderCard, { backgroundColor: colors.buttonBackground, borderColor: colors.buttonBorder }]}
            >
              <Text
                style={[styles.placeholderText, { color: colors.textSecondary }]}
                allowFontScaling
                maxFontSizeMultiplier={1.5}
              >
                No sub-actions yet. Tap "Add Action" to start building a chain.
              </Text>
            </View>
          )}

          {subActions.map((sa, index) => (
            <View
              key={sa.id}
              style={[
                styles.subActionCard,
                {
                  backgroundColor: colors.buttonBackground,
                  borderColor: colors.buttonBorder,
                },
              ]}
            >
              {/* Sub-action header */}
              <View style={styles.subActionHeader}>
                <Text
                  style={[styles.subActionIndex, { color: colors.accent }]}
                  allowFontScaling
                  maxFontSizeMultiplier={1.5}
                >
                  #{index + 1}
                </Text>
                <View style={styles.subActionReorder}>
                  <TouchableOpacity
                    onPress={() => moveSubAction(index, 'up')}
                    disabled={index === 0}
                    accessibilityRole="button"
                    accessibilityLabel={`Move action ${index + 1} up`}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={{ opacity: index === 0 ? 0.3 : 1 }}
                  >
                    <Text
                      style={[styles.reorderArrow, { color: colors.textSecondary }]}
                      allowFontScaling
                      maxFontSizeMultiplier={1.5}
                    >
                      {'\u25B2'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => moveSubAction(index, 'down')}
                    disabled={index === subActions.length - 1}
                    accessibilityRole="button"
                    accessibilityLabel={`Move action ${index + 1} down`}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={{ opacity: index === subActions.length - 1 ? 0.3 : 1 }}
                  >
                    <Text
                      style={[styles.reorderArrow, { color: colors.textSecondary }]}
                      allowFontScaling
                      maxFontSizeMultiplier={1.5}
                    >
                      {'\u25BC'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  onPress={() => removeSubAction(sa.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove action ${index + 1}`}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text
                    style={[styles.removeSubAction, { color: colors.statusRed }]}
                    allowFontScaling
                    maxFontSizeMultiplier={1.5}
                  >
                    {'\u00D7'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Sub-action type picker */}
              <View style={styles.subActionTypeRow}>
                {(['keybind', 'app_launch', 'system_action'] as const).map((t) => {
                  const typeLabels: Record<SubActionType, string> = {
                    keybind: 'Keybind',
                    app_launch: 'App Launch',
                    system_action: 'System',
                  };
                  const selected = sa.type === t;
                  return (
                    <TouchableOpacity
                      key={t}
                      style={[
                        styles.subActionTypeChip,
                        {
                          backgroundColor: selected ? colors.accent : 'transparent',
                          borderColor: selected ? colors.accent : colors.buttonBorder,
                        },
                      ]}
                      onPress={() => updateSubAction(sa.id, { type: t, keys: [], appPath: '', systemAction: 'volume_up' })}
                      accessibilityRole="button"
                      accessibilityLabel={`${typeLabels[t]} type${selected ? ', selected' : ''}`}
                      accessibilityState={{ selected }}
                    >
                      <Text
                        style={[
                          styles.subActionTypeText,
                          { color: selected ? '#FFFFFF' : colors.text },
                        ]}
                        allowFontScaling
                        maxFontSizeMultiplier={1.5}
                      >
                        {typeLabels[t]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Sub-action config based on type */}
              {sa.type === 'keybind' && (
                <View style={styles.subActionConfig}>
                  <View style={styles.selectedKeysRow}>
                    {sa.keys.length === 0 ? (
                      <Text
                        style={[styles.subActionHint, { color: colors.textSecondary }]}
                        allowFontScaling
                        maxFontSizeMultiplier={1.5}
                      >
                        Tap to select keys
                      </Text>
                    ) : (
                      sa.keys.map((key, ki) => (
                        <React.Fragment key={key}>
                          {ki > 0 && (
                            <Text style={[styles.plusSign, { color: colors.textSecondary }]}>+</Text>
                          )}
                          <TouchableOpacity
                            style={[styles.selectedKeyChip, { backgroundColor: colors.accent }]}
                            onPress={() =>
                              updateSubAction(sa.id, { keys: sa.keys.filter((k) => k !== key) })
                            }
                            accessibilityRole="button"
                            accessibilityLabel={`Remove ${key} from action ${index + 1}`}
                          >
                            <Text style={styles.selectedKeyText} allowFontScaling maxFontSizeMultiplier={1.5}>
                              {key.toUpperCase()}
                            </Text>
                            <Text style={styles.removeKeyIcon} allowFontScaling maxFontSizeMultiplier={1.5}>
                              {' \u00D7'}
                            </Text>
                          </TouchableOpacity>
                        </React.Fragment>
                      ))
                    )}
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.subActionKeysScroll}
                  >
                    {KEY_CATEGORIES.flatMap((cat) => cat.keys).slice(0, 30).map((key) => {
                      const isKeySelected = sa.keys.includes(key);
                      return (
                        <TouchableOpacity
                          key={key}
                          style={[
                            styles.miniKeyButton,
                            {
                              backgroundColor: isKeySelected ? colors.accent : colors.background,
                              borderColor: isKeySelected ? colors.accent : colors.buttonBorder,
                            },
                          ]}
                          onPress={() => {
                            if (isKeySelected) {
                              updateSubAction(sa.id, { keys: sa.keys.filter((k) => k !== key) });
                            } else if (sa.keys.length < 6) {
                              updateSubAction(sa.id, { keys: [...sa.keys, key] });
                            }
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={`${key} key${isKeySelected ? ', selected' : ''}`}
                        >
                          <Text
                            style={[
                              styles.miniKeyText,
                              { color: isKeySelected ? '#FFFFFF' : colors.text },
                            ]}
                            allowFontScaling
                            maxFontSizeMultiplier={1.5}
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

              {sa.type === 'app_launch' && (
                <View style={styles.subActionConfig}>
                  <TextInput
                    style={[
                      styles.subActionInput,
                      {
                        backgroundColor: colors.background,
                        color: colors.text,
                        borderColor: colors.buttonBorder,
                      },
                    ]}
                    value={sa.appPath}
                    onChangeText={(text) => updateSubAction(sa.id, { appPath: text })}
                    placeholder='C:\Program Files\App\app.exe'
                    placeholderTextColor={colors.textSecondary + '88'}
                    autoCapitalize="none"
                    autoCorrect={false}
                    accessibilityLabel={`Application path for action ${index + 1}`}
                    allowFontScaling
                    maxFontSizeMultiplier={1.5}
                  />
                </View>
              )}

              {sa.type === 'system_action' && (
                <View style={styles.subActionConfig}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.subActionKeysScroll}
                  >
                    {SYSTEM_ACTIONS.map(({ value, label: actionLabel }) => {
                      const isActionSelected = sa.systemAction === value;
                      return (
                        <TouchableOpacity
                          key={value}
                          style={[
                            styles.miniSystemChip,
                            {
                              backgroundColor: isActionSelected ? colors.accent : colors.background,
                              borderColor: isActionSelected ? colors.accent : colors.buttonBorder,
                            },
                          ]}
                          onPress={() => updateSubAction(sa.id, { systemAction: value })}
                          accessibilityRole="button"
                          accessibilityLabel={`${actionLabel}${isActionSelected ? ', selected' : ''}`}
                        >
                          <Text
                            style={[
                              styles.miniKeyText,
                              { color: isActionSelected ? '#FFFFFF' : colors.text },
                            ]}
                            allowFontScaling
                            maxFontSizeMultiplier={1.5}
                            numberOfLines={1}
                          >
                            {actionLabel}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* Delay input */}
              <View style={styles.delayRow}>
                <Text
                  style={[styles.delayLabel, { color: colors.textSecondary }]}
                  allowFontScaling
                  maxFontSizeMultiplier={1.5}
                >
                  Delay before next:
                </Text>
                <TextInput
                  style={[
                    styles.delayInput,
                    {
                      backgroundColor: colors.background,
                      color: colors.text,
                      borderColor: colors.buttonBorder,
                    },
                  ]}
                  value={sa.delay > 0 ? String(sa.delay) : ''}
                  onChangeText={(text) => {
                    const num = parseInt(text, 10);
                    if (text === '') {
                      updateSubAction(sa.id, { delay: 0 });
                    } else if (!isNaN(num)) {
                      updateSubAction(sa.id, { delay: Math.min(Math.max(num, 0), MAX_DELAY_MS) });
                    }
                  }}
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary + '88'}
                  keyboardType="number-pad"
                  maxLength={4}
                  accessibilityLabel={`Delay in milliseconds before next action`}
                  allowFontScaling
                  maxFontSizeMultiplier={1.5}
                />
                <Text
                  style={[styles.delayUnit, { color: colors.textSecondary }]}
                  allowFontScaling
                  maxFontSizeMultiplier={1.5}
                >
                  ms
                </Text>
              </View>
            </View>
          ))}

          {/* Add action button */}
          {subActions.length < MAX_SUB_ACTIONS && (
            <TouchableOpacity
              style={[
                styles.addSubActionButton,
                { borderColor: colors.accent },
              ]}
              onPress={addSubAction}
              accessibilityRole="button"
              accessibilityLabel="Add sub-action"
            >
              <Text
                style={[styles.addSubActionText, { color: colors.accent }]}
                allowFontScaling
                maxFontSizeMultiplier={1.5}
              >
                + Add Action
              </Text>
            </TouchableOpacity>
          )}

          {subActions.length >= MAX_SUB_ACTIONS && (
            <Text
              style={[styles.subActionLimitText, { color: colors.textSecondary }]}
              allowFontScaling
              maxFontSizeMultiplier={1.5}
            >
              Maximum of {MAX_SUB_ACTIONS} sub-actions reached.
            </Text>
          )}
        </View>
      )}

      {/* Color Picker */}
      <View style={styles.section}>
        <Text
          style={[styles.sectionTitle, { color: colors.text }]}
          allowFontScaling
          maxFontSizeMultiplier={1.5}
        >
          Button Color
        </Text>
        <View style={styles.colorGrid}>
          {PALETTE_COLORS.map((hex) => {
            const isSelected = selectedColor === hex;
            return (
              <TouchableOpacity
                key={hex}
                style={[
                  styles.colorSwatch,
                  {
                    backgroundColor: hex,
                    borderWidth: isSelected ? 3 : 1,
                    borderColor: isSelected ? '#FFFFFF' : colors.buttonBorder,
                  },
                ]}
                onPress={() => setSelectedColor(hex)}
                accessibilityRole="button"
                accessibilityLabel={`Color ${hex}${isSelected ? ', selected' : ''}`}
                accessibilityState={{ selected: isSelected }}
              />
            );
          })}
        </View>
      </View>

      {/* Icon Picker */}
      <View style={styles.section}>
        <Text
          style={[styles.sectionTitle, { color: colors.text }]}
          allowFontScaling
          maxFontSizeMultiplier={1.5}
        >
          Icon
        </Text>

        {/* Icon category tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ maxHeight: 36, marginBottom: 10 }}
          contentContainerStyle={{ gap: 4 }}
        >
          {ICON_CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.categoryTab,
                {
                  backgroundColor: iconCategory === cat ? colors.accent + '33' : 'transparent',
                  borderBottomColor: iconCategory === cat ? colors.accent : 'transparent',
                },
              ]}
              onPress={() => setIconCategory(cat)}
              accessibilityRole="tab"
              accessibilityLabel={`${cat} icons category`}
              accessibilityState={{ selected: iconCategory === cat }}
            >
              <Text
                style={[
                  styles.categoryTabText,
                  { color: iconCategory === cat ? colors.accent : colors.textSecondary },
                ]}
                allowFontScaling
                maxFontSizeMultiplier={1.5}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Icon grid */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {/* No-icon option */}
          <TouchableOpacity
            style={[
              styles.keyButton,
              {
                backgroundColor: !selectedIcon ? colors.accent : colors.buttonBackground,
                borderColor: !selectedIcon ? colors.accent : colors.buttonBorder,
                width: 44,
                height: 44,
                justifyContent: 'center',
                alignItems: 'center',
              },
            ]}
            onPress={() => setSelectedIcon(undefined)}
            accessibilityRole="button"
            accessibilityLabel="No icon"
            accessibilityState={{ selected: !selectedIcon }}
          >
            <Text style={{ color: !selectedIcon ? '#FFF' : colors.textSecondary, fontSize: 11, fontWeight: '700' }}>None</Text>
          </TouchableOpacity>

          {getIconsByCategory(iconCategory).map((icon) => {
            const isSelected = selectedIcon === icon.name;
            return (
              <TouchableOpacity
                key={icon.name}
                style={[
                  styles.keyButton,
                  {
                    backgroundColor: isSelected ? colors.accent : colors.buttonBackground,
                    borderColor: isSelected ? colors.accent : colors.buttonBorder,
                    width: 44,
                    height: 44,
                    justifyContent: 'center',
                    alignItems: 'center',
                  },
                ]}
                onPress={() => setSelectedIcon(icon.name)}
                accessibilityRole="button"
                accessibilityLabel={`${icon.name} icon${isSelected ? ', selected' : ''}`}
                accessibilityState={{ selected: isSelected }}
              >
                <IconView
                  name={icon.name}
                  size={22}
                  color={isSelected ? '#FFFFFF' : colors.text}
                />
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Image Picker */}
      <View style={styles.section}>
        <Text
          style={[styles.sectionTitle, { color: colors.text }]}
          allowFontScaling
          maxFontSizeMultiplier={1.5}
        >
          Custom Image
        </Text>
        {customImage ? (
          <View style={styles.imagePreviewRow}>
            <View
              style={[styles.imagePreviewThumb, { borderColor: colors.buttonBorder }]}
            >
              <Text
                style={[styles.imagePreviewEmoji, { color: colors.accent }]}
                allowFontScaling
                maxFontSizeMultiplier={1.5}
              >
                {'\u2713'}
              </Text>
              <Text
                style={[styles.imagePreviewUri, { color: colors.textSecondary }]}
                numberOfLines={1}
                allowFontScaling
                maxFontSizeMultiplier={1.5}
              >
                Image selected
              </Text>
            </View>
            <View style={styles.imagePreviewActions}>
              <TouchableOpacity
                style={[styles.imageChangeButton, { borderColor: colors.accent }]}
                onPress={handleImagePicker}
                accessibilityRole="button"
                accessibilityLabel="Change custom image"
              >
                <Text
                  style={[styles.imageChangeText, { color: colors.accent }]}
                  allowFontScaling
                  maxFontSizeMultiplier={1.5}
                >
                  Change
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.imageClearButton, { borderColor: colors.statusRed }]}
                onPress={() => setCustomImage(undefined)}
                accessibilityRole="button"
                accessibilityLabel="Remove custom image"
              >
                <Text
                  style={[styles.imageClearText, { color: colors.statusRed }]}
                  allowFontScaling
                  maxFontSizeMultiplier={1.5}
                >
                  Remove
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={[
              styles.imagePickerButton,
              { borderColor: colors.buttonBorder, backgroundColor: colors.buttonBackground },
            ]}
            onPress={handleImagePicker}
            accessibilityRole="button"
            accessibilityLabel="Choose custom button image"
          >
            <Text
              style={[styles.imagePickerText, { color: colors.textSecondary }]}
              allowFontScaling
              maxFontSizeMultiplier={1.5}
            >
              Choose from Camera Roll
            </Text>
            {!isPro && (
              <Text
                style={[styles.proTag, { color: colors.accent }]}
                allowFontScaling
                maxFontSizeMultiplier={1.5}
              >
                PRO
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Action buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.cancelButton, { borderColor: colors.buttonBorder }]}
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="Cancel editing"
        >
          <Text
            style={[styles.cancelButtonText, { color: colors.textSecondary }]}
            allowFontScaling
            maxFontSizeMultiplier={1.5}
          >
            Cancel
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.accent }]}
          onPress={handleSave}
          accessibilityRole="button"
          accessibilityLabel="Save button changes"
        >
          <Text
            style={styles.saveButtonText}
            allowFontScaling
            maxFontSizeMultiplier={1.5}
          >
            Save
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

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
  previewSection: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  previewButton: {
    width: 80,
    height: 80,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewIcon: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  previewLabel: {
    fontSize: 11,
    textAlign: 'center',
    paddingHorizontal: 4,
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
  hintText: {
    fontSize: 12,
    marginTop: 6,
  },
  actionTypeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionTypeChip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  actionTypeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  selectedKeysRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    minHeight: 40,
    gap: 4,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  selectedKeyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  selectedKeyText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  removeKeyIcon: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  plusSign: {
    fontSize: 16,
    fontWeight: '700',
    marginHorizontal: 2,
  },
  placeholderText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  categoryScroll: {
    maxHeight: 40,
    marginBottom: 10,
  },
  categoryContent: {
    gap: 4,
  },
  categoryTab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 2,
    borderRadius: 4,
  },
  categoryTabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  keysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  keyButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 42,
    alignItems: 'center',
  },
  keyButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  systemActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  systemActionChip: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  systemActionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  placeholderCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 20,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  colorSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  imagePickerButton: {
    borderWidth: 1,
    borderRadius: 12,
    borderStyle: 'dashed',
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  imagePickerText: {
    fontSize: 14,
    fontWeight: '500',
  },
  proTag: {
    fontSize: 10,
    fontWeight: '800',
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  // --- Multi-Action Builder ---
  subActionCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  subActionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  subActionIndex: {
    fontSize: 14,
    fontWeight: '800',
    flex: 1,
  },
  subActionReorder: {
    flexDirection: 'row',
    gap: 12,
    marginRight: 12,
  },
  reorderArrow: {
    fontSize: 14,
    fontWeight: '700',
  },
  removeSubAction: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 22,
  },
  subActionTypeRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  subActionTypeChip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    alignItems: 'center',
  },
  subActionTypeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  subActionConfig: {
    marginTop: 4,
  },
  subActionHint: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  subActionInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },
  subActionKeysScroll: {
    gap: 4,
    paddingVertical: 4,
  },
  miniKeyButton: {
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
  miniSystemChip: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  delayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  delayLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  delayInput: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 13,
    width: 60,
    textAlign: 'center',
  },
  delayUnit: {
    fontSize: 12,
    fontWeight: '500',
  },
  addSubActionButton: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  addSubActionText: {
    fontSize: 14,
    fontWeight: '700',
  },
  subActionLimitText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },

  // --- Image Preview ---
  imagePreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  imagePreviewThumb: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  imagePreviewEmoji: {
    fontSize: 18,
    fontWeight: '700',
  },
  imagePreviewUri: {
    fontSize: 13,
    flex: 1,
  },
  imagePreviewActions: {
    flexDirection: 'row',
    gap: 6,
  },
  imageChangeButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  imageChangeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  imageClearButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  imageClearText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
