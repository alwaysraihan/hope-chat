/**
 * Text-input prompt.
 *
 * React Native's `Alert.prompt` is iOS-only — on Android it is undefined, so an
 * optional call silently does nothing and the action appears to be ignored.
 * This works on both platforms.
 */

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useColors } from '../hooks/useColors';

type Props = {
  visible: boolean;
  title: string;
  message?: string;
  placeholder?: string;
  submitLabel?: string;
  /** Block submit until something is typed. */
  requireText?: boolean;
  submitting?: boolean;
  onCancel: () => void;
  onSubmit: (value: string) => void;
};

export default function PromptModal({
  visible,
  title,
  message,
  placeholder,
  submitLabel = 'Submit',
  requireText = false,
  submitting = false,
  onCancel,
  onSubmit,
}: Props) {
  const colorss = useColors();
  const [value, setValue] = useState('');

  // Reset between openings so a previous draft never leaks into a new prompt.
  useEffect(() => {
    if (visible) setValue('');
  }, [visible]);

  const canSubmit = !submitting && (!requireText || value.trim().length > 0);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onCancel} />
        <View style={styles.centerWrap} pointerEvents="box-none">
          <View style={[styles.card, { backgroundColor: colorss.white }]}>
            <Text style={[styles.title, { color: colorss.textPrimary }]}>
              {title}
            </Text>
            {message ? (
              <Text style={[styles.message, { color: colorss.textSecondary }]}>
                {message}
              </Text>
            ) : null}

            <TextInput
              style={[
                styles.input,
                { color: colorss.textPrimary, borderColor: colorss.border },
              ]}
              value={value}
              onChangeText={setValue}
              placeholder={placeholder}
              placeholderTextColor={colorss.placeholder}
              multiline
              autoFocus
            />

            <View style={styles.row}>
              <TouchableOpacity
                style={styles.btn}
                onPress={onCancel}
                disabled={submitting}
              >
                <Text style={[styles.btnText, { color: colorss.textSecondary }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, !canSubmit && styles.btnDisabled]}
                onPress={() => onSubmit(value.trim())}
                disabled={!canSubmit}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={colorss.primary} />
                ) : (
                  <Text style={[styles.btnText, { color: colorss.primary }]}>
                    {submitLabel}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  centerWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  card: { borderRadius: 16, padding: 20 },
  title: { fontSize: 17, fontWeight: '700' },
  message: { fontSize: 13, lineHeight: 18, marginTop: 6 },
  input: {
    marginTop: 14,
    minHeight: 76,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  row: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 14 },
  btn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8 },
  btnDisabled: { opacity: 0.45 },
  btnText: { fontSize: 14, fontWeight: '700' },
});
