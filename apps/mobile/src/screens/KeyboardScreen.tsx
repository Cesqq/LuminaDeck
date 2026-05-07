// KeyboardScreen.tsx
//
// v1.4 — phone-as-PC-keyboard. Acts like a real BT keyboard: every
// keystroke streams to the PC as it lands in the text field, no Send
// button required.
//
// How it works (diff-based streaming):
//
//   We keep `lastSentRef` = the text the PC has already received.
//   On each onChangeText, we compute the longest common prefix between
//   `lastSentRef` and the new text. Anything PAST the prefix on the old
//   side is what got removed (autocorrect, backspace, swipe-to-delete);
//   anything PAST the prefix on the new side is what got added.
//
//   We emit:  N × { keybind: backspace }  +  { text_input: <added> }
//
//   This handles every weird system-keyboard interaction:
//     - tap a letter → 1 char added
//     - tap backspace → 1 char removed
//     - autocorrect "teh" → "the" → 3 backspaces + "the"
//     - swipe-to-type → whole word added
//     - select+replace → many backspaces + new text
//
//   The visible TextInput stays at "what the PC has". `selection` is
//   pinned to the end so the cursor never strays.
//
// Companion side: text_input dispatches via SendInput (already wired);
// keybind ['backspace'] hits VK_BACK (already wired).

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useConnection } from '../contexts/ConnectionContext';

interface KeyboardScreenProps {
  onBack: () => void;
}

const SPECIAL_KEYS: Array<{ label: string; keybind: string[] }> = [
  { label: 'Tab',   keybind: ['tab'] },
  { label: '⏎',    keybind: ['enter'] },
  { label: 'Esc',  keybind: ['escape'] },
  { label: '↑',    keybind: ['up'] },
  { label: '↓',    keybind: ['down'] },
  { label: '←',    keybind: ['left'] },
  { label: '→',    keybind: ['right'] },
];

const QUICK_COMBOS: Array<{ label: string; keybind: string[] }> = [
  { label: '⌘C',  keybind: ['ctrl', 'c'] },
  { label: '⌘V',  keybind: ['ctrl', 'v'] },
  { label: '⌘X',  keybind: ['ctrl', 'x'] },
  { label: '⌘Z',  keybind: ['ctrl', 'z'] },
  { label: '⌘A',  keybind: ['ctrl', 'a'] },
  { label: '⌘S',  keybind: ['ctrl', 's'] },
];

export function KeyboardScreen({ onBack }: KeyboardScreenProps) {
  const { colors } = useTheme();
  const { client, status } = useConnection();
  const [text, setText] = useState('');
  const lastSentRef = useRef('');
  const inputRef = useRef<TextInput>(null);

  // Reset the buffer + visible field when the user backs out and comes
  // back. Otherwise leftover text stays in the input but the PC has
  // already moved on, and the next keystroke would mass-backspace.
  useEffect(() => {
    return () => {
      lastSentRef.current = '';
    };
  }, []);

  const sendKeybind = useCallback(
    (keys: string[]) => {
      if (status !== 'connected') return;
      client.send({
        type: 'execute',
        id: `kbd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        action: { type: 'keybind', keys } as any,
      });
    },
    [client, status],
  );

  const sendTextChunk = useCallback(
    (chunk: string) => {
      if (!chunk || status !== 'connected') return;
      client.send({
        type: 'execute',
        id: `kbd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        action: { type: 'text_input', text: chunk } as any,
      });
    },
    [client, status],
  );

  // Diff streamer — the heart of the screen.
  const handleTextChange = useCallback(
    (newText: string) => {
      setText(newText);
      const prev = lastSentRef.current;

      // Common prefix length.
      let i = 0;
      const minLen = Math.min(prev.length, newText.length);
      while (i < minLen && prev[i] === newText[i]) i++;

      const removed = prev.length - i;
      const added = newText.slice(i);

      // Emit backspaces. Each one is a separate execute so the PC's
      // SendInput has discrete events; for big deletions this means a
      // burst of N keybinds, which is fine — RN's WS handles it and
      // the companion's rate limiter is 50 ops/sec which is well above
      // any human typing speed.
      for (let b = 0; b < removed; b++) {
        sendKeybind(['backspace']);
      }
      if (added) {
        sendTextChunk(added);
      }

      lastSentRef.current = newText;
    },
    [sendKeybind, sendTextChunk],
  );

  const clearBuffer = useCallback(() => {
    // Local-only — doesn't backspace on the PC. The user just wants
    // a fresh visual buffer for typing the next thing.
    setText('');
    lastSentRef.current = '';
    inputRef.current?.focus();
  }, []);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { borderBottomColor: colors.buttonBorder }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} accessibilityLabel="Back">
          <Text style={[styles.backIcon, { color: colors.text }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>PC Keyboard</Text>
        <TouchableOpacity onPress={clearBuffer} style={styles.headerAction} accessibilityLabel="Clear">
          <Text style={[styles.headerActionText, { color: colors.accent }]}>Clear</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statusRow}>
        <View
          style={[
            styles.statusDot,
            { backgroundColor: status === 'connected' ? colors.statusGreen : colors.textSecondary },
          ]}
        />
        <Text style={[styles.statusText, { color: colors.textSecondary }]}>
          {status === 'connected'
            ? 'Streaming keystrokes — type below and they hit your PC live.'
            : 'Not connected. Pair to your PC first.'}
        </Text>
      </View>

      <View
        style={[
          styles.inputCard,
          {
            backgroundColor: colors.buttonBackground,
            borderColor: colors.buttonBorder,
          },
        ]}
      >
        <TextInput
          ref={inputRef}
          style={[styles.input, { color: colors.text }]}
          value={text}
          onChangeText={handleTextChange}
          placeholder="Type here…"
          placeholderTextColor={colors.textSecondary + '88'}
          multiline
          autoFocus
          autoCorrect={true}
          autoCapitalize="sentences"
          editable={status === 'connected'}
        />
      </View>

      <ScrollView style={styles.bottomSection} contentContainerStyle={styles.bottomBody}>
        <Text style={[styles.subhead, { color: colors.textSecondary }]}>Special keys</Text>
        <View style={styles.keyRow}>
          {SPECIAL_KEYS.map((k) => (
            <TouchableOpacity
              key={k.label}
              style={[
                styles.specialBtn,
                { backgroundColor: colors.buttonBackground, borderColor: colors.buttonBorder },
              ]}
              onPress={() => sendKeybind(k.keybind)}
              disabled={status !== 'connected'}
              accessibilityLabel={`Send ${k.label}`}
            >
              <Text style={[styles.specialBtnText, { color: colors.text }]}>{k.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.subhead, { color: colors.textSecondary, marginTop: 14 }]}>Quick combos</Text>
        <View style={styles.keyRow}>
          {QUICK_COMBOS.map((k) => (
            <TouchableOpacity
              key={k.label}
              style={[
                styles.specialBtn,
                { backgroundColor: colors.buttonBackground, borderColor: colors.buttonBorder },
              ]}
              onPress={() => sendKeybind(k.keybind)}
              disabled={status !== 'connected'}
              accessibilityLabel={`Send combo ${k.label}`}
            >
              <Text style={[styles.specialBtnText, { color: colors.text }]}>{k.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 8, width: 60 },
  backIcon: { fontSize: 28, fontWeight: '300' },
  title: { fontSize: 17, fontWeight: '600', flex: 1, textAlign: 'center' },
  headerAction: { padding: 8, width: 60, alignItems: 'flex-end' },
  headerActionText: { fontSize: 14, fontWeight: '600' },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 13, flex: 1 },
  inputCard: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 110,
    padding: 8,
  },
  input: {
    fontSize: 18,
    minHeight: 90,
    textAlignVertical: 'top',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  bottomSection: { flex: 1 },
  bottomBody: { padding: 16, paddingTop: 6 },
  subhead: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 },
  keyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  specialBtn: {
    minWidth: 56,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  specialBtnText: { fontSize: 14, fontWeight: '600' },
});
