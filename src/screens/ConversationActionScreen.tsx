import React, { useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  Archive,
  Bell,
  BellOff,
  LogOut,
  LucidePin,
  PinOff,
  Tag,
  Trash,
  UserPlus,
} from 'lucide-react-native';
import Animated from 'react-native-reanimated';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useColors } from '../hooks/useColors';
import { RootStackNavigatorParamList } from '../types/navigators';
import { useAppSelector } from '../hooks/redux';
import { selectAuthToken } from '../redux/features/auth/authSlice';
import {
  deleteConversation,
  patchConversationArchive,
  patchConversationMute,
  patchConversationPin,
} from '../services/userSettingsService';
import { leaveGroup } from '../services/groupService';
import { useChats } from '../context/ChatsContext';
import {
  addHiddenConversation,
  writeChatDirectoryCache,
} from '../services/offlineCache';
import { useAppSelector as useSel } from '../hooks/redux';
import { selectHopenityProfile } from '../redux/features/auth/authSlice';

type Props = NativeStackScreenProps<RootStackNavigatorParamList, 'ConversationAction'>;

const ConversationActionScreen: React.FC<Props> = ({ navigation, route }) => {
  const colorss = useColors();
  const styles = useMemo(() => StyleSheet.create({
    sheet: {
      backgroundColor: colorss.cardBg, paddingVertical: 20,
      borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingBottom: 36,
    },
    handle: { width: 80, height: 4, backgroundColor: colorss.border, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
    chatName: { fontSize: 14, fontWeight: '600', color: colorss.textSecondary, textAlign: 'center', marginBottom: 8, paddingHorizontal: 20 },
    body: { gap: 4, paddingHorizontal: 20 },
    row: {
      flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colorss.border,
    },
    label: { color: colorss.textPrimary, fontSize: 16, fontWeight: '500' },
    labelDanger: { color: colorss.error },
  }), [colorss]);

  const {
    conversationId,
    conversationName,
    isGroup,
    isMuted: initialMuted = false,
    isPinned: initialPinned = false,
  } = route.params;

  const token = useAppSelector(selectAuthToken);
  const profile = useSel(selectHopenityProfile);
  const { setConversations } = useChats();
  const [busy, setBusy] = useState<string | null>(null);
  const [muted, setMuted] = useState(initialMuted);
  const [pinned, setPinned] = useState(initialPinned);

  const removeConversationLocally = () => {
    // Add to persistent hidden list so it never re-appears from cache or server reload.
    addHiddenConversation(conversationId);
    setConversations(prev => {
      const next = prev.filter(c => c.id !== conversationId);
      const uid = String(profile?.userId ?? '');
      if (uid && uid !== 'me') {
        writeChatDirectoryCache(uid, next);
      }
      return next;
    });
  };

  const handlePin = async () => {
    if (!token) return;
    setBusy('pin');
    const next = !pinned;
    const ok = await patchConversationPin(conversationId, next, token);
    setBusy(null);
    if (ok) {
      setPinned(next);
      Alert.alert(next ? 'Pinned' : 'Unpinned', `Chat ${next ? 'pinned' : 'unpinned'}.`);
    } else {
      Alert.alert('Error', 'Could not update pin status. Try again.');
    }
  };

  const handleMute = async () => {
    if (!token) return;
    setBusy('mute');
    const next = !muted;
    const ok = await patchConversationMute(conversationId, next, token);
    setBusy(null);
    if (ok) {
      setMuted(next);
    } else {
      Alert.alert('Error', 'Could not update mute. Try again.');
    }
  };

  const handleArchive = () => {
    if (!token) return;
    Alert.alert('Archive chat', `Archive your conversation with ${conversationName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        onPress: () => {
          // Optimistic: hide immediately, fire API best-effort.
          removeConversationLocally();
          patchConversationArchive(conversationId, true, token).catch(() => {});
          navigation.navigate('BottomTab', { screen: 'Home' });
        },
      },
    ]);
  };

  const handleAddMembers = () => {
    navigation.navigate('AddGroupMembers', {
      groupId: conversationId,
      existingMemberIds: [],
    });
  };

  const handleLeave = () => {
    if (!token) return;
    Alert.alert('Leave group', `Leave "${conversationName}"? You won't be able to receive messages from this group.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          setBusy('leave');
          const ok = await leaveGroup(conversationId, token);
          setBusy(null);
          if (ok) {
            removeConversationLocally();
            navigation.navigate('BottomTab', { screen: 'Home' });
          } else {
            Alert.alert('Error', 'Could not leave the group. Try again.');
          }
        },
      },
    ]);
  };

  const handleDelete = () => {
    if (!token) return;
    Alert.alert(
      'Delete chat',
      `Delete your conversation with ${conversationName}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            removeConversationLocally();
            deleteConversation(conversationId, token).catch(() => {});
            navigation.navigate('BottomTab', { screen: 'Home' });
          },
        },
      ],
    );
  };

  type Action = {
    id: string;
    title: string;
    icon: React.ReactNode;
    onPress: () => void;
    destructive?: boolean;
    show?: boolean;
  };

  const actions: Action[] = [
    {
      id: 'pin',
      title: pinned ? 'Unpin chat' : 'Pin chat',
      icon: busy === 'pin'
        ? <ActivityIndicator size="small" color={colorss.primary} />
        : pinned
        ? <PinOff size={22} color={colorss.primary} />
        : <LucidePin size={22} color={colorss.primary} />,
      onPress: handlePin,
    },
    {
      id: 'archive',
      title: 'Archive',
      icon: busy === 'archive'
        ? <ActivityIndicator size="small" color={colorss.primary} />
        : <Archive size={22} color={colorss.primary} />,
      onPress: handleArchive,
    },
    {
      id: 'mute',
      title: muted ? 'Unmute' : 'Mute',
      icon: busy === 'mute'
        ? <ActivityIndicator size="small" color={colorss.primary} />
        : muted
        ? <Bell size={22} color={colorss.primary} />
        : <BellOff size={22} color={colorss.primary} />,
      onPress: handleMute,
    },
    {
      id: 'nicknames',
      title: 'Nicknames',
      icon: <Tag size={22} color={colorss.primary} />,
      onPress: () => navigation.navigate('Nicknames', { conversationId }),
      show: !isGroup,
    },
    {
      id: 'add-members',
      title: 'Add members',
      icon: <UserPlus size={22} color={colorss.primary} />,
      onPress: handleAddMembers,
      show: !!isGroup,
    },
    {
      id: 'leave',
      title: 'Leave group',
      icon: busy === 'leave'
        ? <ActivityIndicator size="small" color={colorss.error} />
        : <LogOut size={22} color={colorss.error} />,
      onPress: handleLeave,
      destructive: true,
      show: !!isGroup,
    },
    {
      id: 'delete',
      title: 'Delete chat',
      icon: busy === 'delete'
        ? <ActivityIndicator size="small" color={colorss.error} />
        : <Trash size={22} color={colorss.error} />,
      onPress: handleDelete,
      destructive: true,
    },
  ].filter(a => a.show !== false);

  return (
    <Animated.View style={styles.sheet}>
      <View style={styles.handle} />
      <Text style={styles.chatName} numberOfLines={1}>{conversationName}</Text>
      <View style={styles.body}>
        {actions.map(action => (
          <TouchableOpacity
            key={action.id}
            style={styles.row}
            onPress={action.onPress}
            disabled={busy !== null}
            activeOpacity={0.7}
          >
            {action.icon}
            <Text style={[styles.label, action.destructive && styles.labelDanger]}>
              {action.title}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );
};

export default ConversationActionScreen;

