import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  ToastAndroid,
  TouchableOpacity,
  View,
} from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import { IC_PROFILE } from '../assets';
import { useChats } from '../context/ChatsContext';
import { useAppSelector } from '../hooks/redux';
import { selectAuthToken } from '../redux/features/auth/authSlice';
import { inviteContactToExistingCall } from '../services/invitePeerToHopeChatCall';
import { useColors } from '../hooks/useColors';

type Props = {
  visible: boolean;
  onClose: () => void;
  liveKitRoom: string;
  callKind: 'audio' | 'video';
};

export function AddPeopleModal({ visible, onClose, liveKitRoom, callKind }: Props) {
  const colorss = useColors();
  const { conversations } = useChats();
  const token = useAppSelector(selectAuthToken);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  const contacts = useMemo(
    () => conversations.filter(c => !c.isGroup && !c.needsAcceptance && c.peerUserId),
    [conversations],
  );

  const styles = useMemo(() => StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
    sheet: {
      backgroundColor: colorss.cardBg,
      borderTopLeftRadius: 20, borderTopRightRadius: 20,
      paddingBottom: 40, maxHeight: '60%',
    },
    handle: {
      width: 36, height: 4, borderRadius: 2, backgroundColor: colorss.border,
      alignSelf: 'center', marginTop: 12, marginBottom: 8,
    },
    title: {
      fontSize: 17, fontWeight: '700', color: colorss.textPrimary, textAlign: 'center',
      paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colorss.border, marginBottom: 8,
    },
    row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10, gap: 12 },
    avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colorss.backgroundDeep },
    name: { flex: 1, color: colorss.textPrimary, fontSize: 15, fontWeight: '500' },
    inviteBtn: {
      backgroundColor: colorss.accent, paddingHorizontal: 16, paddingVertical: 8,
      borderRadius: 8, minWidth: 70, alignItems: 'center',
    },
    inviteText: { color: colorss.white, fontWeight: '600', fontSize: 13 },
    empty: { color: colorss.textSecondary, textAlign: 'center', padding: 24 },
  }), [colorss]);

  const handleInvite = async (conversationId: string, name: string) => {
    if (!token) return;
    setBusyIds(prev => new Set(prev).add(conversationId));
    await inviteContactToExistingCall({ token, conversationId, liveKitRoom, callKind });
    setBusyIds(prev => {
      const next = new Set(prev);
      next.delete(conversationId);
      return next;
    });
    if (Platform.OS === 'android') {
      ToastAndroid.show(`Invited ${name}`, ToastAndroid.SHORT);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>Add People</Text>
        <ScrollView>
          {contacts.length === 0 ? (
            <Text style={styles.empty}>No contacts available to add.</Text>
          ) : (
            contacts.map(c => (
              <View key={c.id} style={styles.row}>
                <FastImage
                  source={c.avatarUrl ? { uri: c.avatarUrl } : IC_PROFILE}
                  style={styles.avatar}
                  resizeMode={FastImage.resizeMode.cover}
                />
                <Text style={styles.name} numberOfLines={1}>{c.name}</Text>
                <TouchableOpacity
                  style={styles.inviteBtn}
                  onPress={() => handleInvite(c.id, c.name)}
                  disabled={busyIds.has(c.id)}
                >
                  {busyIds.has(c.id) ? (
                    <ActivityIndicator size="small" color={colorss.white} />
                  ) : (
                    <Text style={styles.inviteText}>Invite</Text>
                  )}
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
