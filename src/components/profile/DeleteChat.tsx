import React, { useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colorss } from '../../theme';
import { deleteConversation } from '../../services/userSettingsService';
import { addHiddenConversation } from '../../services/offlineCache';

type Props = {
  visible: boolean;
  peerName: string;
  conversationId: string;
  token: string | null;
  onCancel: () => void;
  onDeleted: () => void;
};

const DeleteChat = ({ visible, peerName, conversationId, token, onCancel, onDeleted }: Props) => {
  const [busy, setBusy] = useState(false);

  const handleDelete = async () => {
    if (!token || busy) return;
    setBusy(true);
    // Persist locally first so the chat never re-appears from cache or server reload.
    addHiddenConversation(conversationId);
    // Fire the server delete best-effort — don't block the UX on it.
    deleteConversation(conversationId, token).catch(() => {});
    setBusy(false);
    onDeleted();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <Text style={styles.dialogTitle}>Delete all chat history?</Text>
          <Text style={styles.dialogBody}>
            This will delete your entire conversation with {peerName}. This cannot be undone.
          </Text>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.btn} onPress={onCancel} disabled={busy}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.btn} onPress={handleDelete} disabled={busy}>
              {busy
                ? <ActivityIndicator color={colorss.error} />
                : <Text style={styles.deleteText}>Delete</Text>
              }
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
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24,
  },
  dialog: {
    backgroundColor: colorss.white, borderRadius: 18,
    paddingTop: 26, paddingHorizontal: 24, paddingBottom: 0, width: '100%', maxWidth: 380,
  },
  dialogTitle: { color: colorss.textPrimary, fontSize: 22, fontWeight: '700', marginBottom: 12 },
  dialogBody: { color: colorss.textSecondary, fontSize: 15, lineHeight: 22, marginBottom: 24 },
  actions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colorss.border },
  btn: { flex: 1, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  divider: { width: 1, backgroundColor: colorss.border },
  cancelText: { color: colorss.accent, fontSize: 16, fontWeight: '500' },
  deleteText: { color: colorss.error, fontSize: 16, fontWeight: '700' },
});
