import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { colorss } from '../../theme';

const DeleteChat = ({ visible, onCancel }) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <Text style={styles.dialogTitle}>Delete all chat history?</Text>

          <Text style={styles.dialogBody}>
            This will delete your entire conversation with Emon Hossain, not
            just recent messages.
          </Text>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.btn} onPress={onCancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity style={styles.btn} onPress={onCancel}>
              <Text style={styles.deleteText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default DeleteChat;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },

  dialog: {
    backgroundColor: colorss.white,
    borderRadius: 20,
    paddingTop: 28,
    paddingHorizontal: 24,
    paddingBottom: 0,
    width: '100%',
    maxWidth: 380,
  },

  dialogTitle: {
    color: colorss.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: 10,
  },

  dialogBody: {
    color: colorss.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
    marginBottom: 28,
  },

  actions: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colorss.border,
  },

  btn: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },

  divider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: colorss.border,
  },

  cancelText: {
    color: colorss.accent,
    fontSize: 16,
    fontWeight: '500',
  },

  deleteText: {
    color: colorss.error,
    fontSize: 16,
    fontWeight: '700',
  },
});
