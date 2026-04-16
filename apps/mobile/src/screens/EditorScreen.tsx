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
} from '@luminadeck/shared';
import { VALID_KEYS, MODIFIER_KEYS } from '@luminadeck/shared';
import { useTheme } from '../contexts/ThemeContext';
import { usePro } from '../contexts/ProContext';

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
      case 'multi_action':
        // Multi-action builder is a Pro feature, placeholder for now
        return null;
      default:
        return null;
    }
  }, [actionType, selectedKeys, appPath, systemAction]);

  const handleSave = useCallback(() => {
    if (label.length > 16) {
      Alert.alert('Label too long', 'Button labels must be 16 characters or fewer.');
      return;
    }

    const updated: ButtonConfig = {
      ...button,
      action: builtAction,
      label: label.trim() || undefined,
      color: selectedColor,
    };

    onSave(updated);
  }, [button, builtAction, label, selectedColor, onSave]);

  const handleImagePicker = useCallback(() => {
    if (!isPro) {
      Alert.alert('Pro Feature', 'Custom button images require LuminaDeck Pro.');
      return;
    }
    Alert.alert(
      'Image Picker',
      'Camera roll integration will be available in a future update.',
    );
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
          <Text
            style={[styles.previewIcon, { color: colors.accent }]}
            allowFontScaling
            maxFontSizeMultiplier={1.5}
          >
            {label?.charAt(0)?.toUpperCase() ?? '?'}
          </Text>
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
          <View
            style={[styles.placeholderCard, { backgroundColor: colors.buttonBackground, borderColor: colors.buttonBorder }]}
          >
            <Text
              style={[styles.placeholderText, { color: colors.textSecondary }]}
              allowFontScaling
              maxFontSizeMultiplier={1.5}
            >
              Multi-Action builder coming soon. Chain multiple keybinds, app launches, and system actions into a single button press with configurable delays.
            </Text>
          </View>
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

      {/* Image Picker */}
      <View style={styles.section}>
        <Text
          style={[styles.sectionTitle, { color: colors.text }]}
          allowFontScaling
          maxFontSizeMultiplier={1.5}
        >
          Custom Image
        </Text>
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
});
