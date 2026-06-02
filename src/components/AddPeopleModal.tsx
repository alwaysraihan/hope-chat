import React, { useEffect, useMemo, useState } from 'react';
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
import { fetchGroupInfo, type GroupMember } from '../services/groupService';
import { useColors } from '../hooks/useColors';

type ContactRow = {
  /** Key used to track invite/busy state — conversation ID for DM, userId for group members */
  key: string;
  /** 1:1 conversation ID used to send the call invite */
  conversationId: string;
  name: string;
  avatarUrl?: string | null;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  liveKitRoom: string;
  callKind: 'audio' | 'video';
  /** True when the active call is a group call — shows only group members. */
  isGroupCall?: boolean;
  /** Group ID (= conversationId for group chats) — required when isGroupCall is true. */
  groupId?: string;
};

export function AddPeopleModal({
  visible,
  onClose,
  liveKitRoom,
  callKind,
  isGroupCall,
  groupId,
}: Props) {
  const colorss = useColors();
  const { conversations } = useChats();
  const token = useAppSelector(selectAuthToken);

  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  // Invited IDs persist for the lifetime of the call so the user can see who was
  // already invited without the button resetting when the modal reopens.
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());

  // Group members fetched from the backend (only for group calls).
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  useEffect(() => {
    if (!isGroupCall || !groupId || !token || !visible) return;
    setLoadingMembers(true);
    fetchGroupInfo(groupId, token)
      .then(info => {
        if (info) setGroupMembers(info.members);
      })
      .catch(() => {/* non-fatal */})
      .finally(() => setLoadingMembers(false));
  }, [isGroupCall, groupId, token, visible]);

  // Build contact rows. For group calls use the member list; for personal calls
  // use the DM conversation list. In both cases, resolving the 1:1 conversation
  // ID is needed because inviteContactToExistingCall goes through a DM channel.
  const contacts = useMemo<ContactRow[]>(() => {
    if (isGroupCall) {
      // Map each group member to their 1:1 DM conversation so we can reach them.
      return groupMembers
        .map(member => {
          const dmConv = conversations.find(
            c => !c.isGroup && c.peerUserId === member.userId,
          );
          if (!dmConv) return null;
          return {
            key: member.userId,
            conversationId: dmConv.id,
            name: member.name ?? dmConv.name,
            avatarUrl: member.image ?? dmConv.avatarUrl,
          } as ContactRow;
        })
        .filter((r): r is ContactRow => r !== null);
    }
    // Personal call — show all accepted DM contacts.
    return conversations
      .filter(c => !c.isGroup && !c.needsAcceptance && c.peerUserId)
      .map(c => ({
        key: c.id,
        conversationId: c.id,
        name: c.name,
        avatarUrl: c.avatarUrl,
      }));
  }, [isGroupCall, groupMembers, conversations]);

  const styles = useMemo(() => StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
    sheet: {
      backgroundColor: colorss.cardBg,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingBottom: 40,
      maxHeight: '65%',
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colorss.border,
      alignSelf: 'center',
      marginTop: 12,
      marginBottom: 8,
    },
    title: {
      fontSize: 17,
      fontWeight: '700',
      color: colorss.textPrimary,
      textAlign: 'center',
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colorss.border,
      marginBottom: 8,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 10,
      gap: 12,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colorss.backgroundDeep,
    },
    name: { flex: 1, color: colorss.textPrimary, fontSize: 15, fontWeight: '500' },
    inviteBtn: {
      backgroundColor: colorss.accent,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      minWidth: 80,
      alignItems: 'center',
    },
    invitedBtn: {
      backgroundColor: colorss.success ?? '#22c55e',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      minWidth: 80,
      alignItems: 'center',
    },
    inviteText: { color: colorss.white, fontWeight: '600', fontSize: 13 },
    empty: { color: colorss.textSecondary, textAlign: 'center', padding: 24 },
    loadingWrap: { padding: 24, alignItems: 'center' },
  }), [colorss]);

  const handleInvite = async (contact: ContactRow) => {
    if (!token || busyIds.has(contact.key) || invitedIds.has(contact.key)) return;
    setBusyIds(prev => new Set(prev).add(contact.key));
    await inviteContactToExistingCall({
      token,
      conversationId: contact.conversationId,
      liveKitRoom,
      callKind,
    });
    setBusyIds(prev => { const next = new Set(prev); next.delete(contact.key); return next; });
    setInvitedIds(prev => new Set(prev).add(contact.key));
    if (Platform.OS === 'android') {
      ToastAndroid.show(`Invited ${contact.name}`, ToastAndroid.SHORT);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>
          {isGroupCall ? 'Invite Group Members' : 'Add People'}
        </Text>
        <ScrollView>
          {loadingMembers ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="small" color={colorss.accent} />
            </View>
          ) : contacts.length === 0 ? (
            <Text style={styles.empty}>
              {isGroupCall
                ? 'No group members available to invite.'
                : 'No contacts available to add.'}
            </Text>
          ) : (
            contacts.map(c => {
              const isBusy = busyIds.has(c.key);
              const isInvited = invitedIds.has(c.key);
              return (
                <View key={c.key} style={styles.row}>
                  <FastImage
                    source={c.avatarUrl ? { uri: c.avatarUrl } : IC_PROFILE}
                    style={styles.avatar}
                    resizeMode={FastImage.resizeMode.cover}
                  />
                  <Text style={styles.name} numberOfLines={1}>{c.name}</Text>
                  <TouchableOpacity
                    style={isInvited ? styles.invitedBtn : styles.inviteBtn}
                    onPress={() => handleInvite(c)}
                    disabled={isBusy || isInvited}
                  >
                    {isBusy ? (
                      <ActivityIndicator size="small" color={colorss.white} />
                    ) : (
                      <Text style={styles.inviteText}>
                        {isInvited ? 'Invited' : 'Invite'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
