import React, { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppColors, useAppTheme } from '../context/ThemeContext';

type Props = {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

const ConfirmSheet: React.FC<Props> = ({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive,
  onConfirm,
  onCancel,
}) => {
  const { colors } = useAppTheme();
  const styles = useMemo(() => stylesFunc(colors), [colors]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={evt => evt.stopPropagation?.()}>
          <View style={styles.handle} />
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}

          <Pressable
            style={({ pressed }) => [
              styles.confirmBtn,
              destructive && styles.confirmBtnDestructive,
              pressed && styles.pressed,
            ]}
            onPress={onConfirm}
          >
            <Text
              style={[
                styles.confirmText,
                destructive && styles.confirmTextDestructive,
              ]}
            >
              {confirmLabel}
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}
            onPress={onCancel}
          >
            <Text style={styles.cancelText}>{cancelLabel}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const stylesFunc = (colorss: AppColors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colorss.cardBg,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 32,
      alignItems: 'center',
    },
    handle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colorss.border,
      marginBottom: 18,
    },
    title: {
      fontSize: 17,
      fontWeight: '700',
      color: colorss.textPrimary,
      textAlign: 'center',
      marginBottom: 6,
    },
    message: {
      fontSize: 14,
      color: colorss.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 22,
    },
    confirmBtn: {
      alignSelf: 'stretch',
      backgroundColor: colorss.accent,
      borderRadius: 14,
      paddingVertical: 15,
      alignItems: 'center',
      marginBottom: 10,
    },
    confirmBtnDestructive: {
      backgroundColor: colorss.error,
    },
    confirmText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
    confirmTextDestructive: {
      color: '#FFFFFF',
    },
    cancelBtn: {
      alignSelf: 'stretch',
      borderRadius: 14,
      paddingVertical: 15,
      alignItems: 'center',
      backgroundColor: colorss.surface,
    },
    cancelText: {
      color: colorss.textPrimary,
      fontSize: 16,
      fontWeight: '600',
    },
    pressed: {
      opacity: 0.8,
    },
  });

export default ConfirmSheet;
