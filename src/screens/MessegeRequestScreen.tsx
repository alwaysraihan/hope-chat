import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, MoreVertical } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import FastImage from '@d11/react-native-fast-image';

import { colorss as C } from '../theme';
import { RootStackNavigatorParamList } from '../types/navigators';
import {
  acceptHopenityChatRequest,
  fetchHopenityChatDirectory,
  formatChatTime,
  HopenityChatItem,
} from '../services/chatService';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import {
  clearAuth,
  selectAuthToken,
  selectHopenityProfile,
} from '../redux/features/auth/authSlice';
import { mapChatItemToSummary, useChats } from '../context/ChatsContext';
import { normalizeChatUserId } from '../utils/chatUserId';
import { resolveLiveKitRoomName } from '../utils/livekitRoomId';

type Props = NativeStackScreenProps<RootStackNavigatorParamList, 'MessageRequests'>;

/** Hide empty REQUESTED rows (no text yet) — “just created” chats with no first message. */
function requestedChatHasMessage(chat: HopenityChatItem): boolean {
  const last = chat.messages?.[0] ?? chat.lastMessage;
  const content = String(last?.content ?? '').trim();
  return content.length > 0;
}

const MessageRequestsScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const token = useAppSelector(selectAuthToken);
  const giftedChatUser = useAppSelector(s => s.auth.giftedChatUser);
  const profile = useAppSelector(selectHopenityProfile);
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const localUser = useMemo(
    () => ({
      _id:
        normalizeChatUserId(giftedChatUser?._id) ||
        normalizeChatUserId(profile?.userId) ||
        'me',
      name:
        giftedChatUser?.name ?? profile?.displayName ?? 'You',
    }),
    [giftedChatUser, profile],
  );

  const { reloadConversations } = useChats();
  const [activeTab, setActiveTab] = useState<'know' | 'spam'>('know');
  const [loading, setLoading] = useState(false);
  const [requested, setRequested] = useState<HopenityChatItem[]>([]);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const loadRequested = useCallback(async () => {
    if (!token) {
      setRequested([]);
      return;
    }
    setLoading(true);
    try {
      const { chats, httpStatus } = await fetchHopenityChatDirectory(token, {
        status: 'requested',
        limit: 100,
        offset: 0,
      });
      if (httpStatus === 401) {
        dispatch(clearAuth());
        setRequested([]);
        return;
      }
      setRequested(chats.filter(requestedChatHasMessage));
    } catch (e) {
      console.error('[MessageRequestsScreen] load requested:', e);
      setRequested([]);
    } finally {
      setLoading(false);
    }
  }, [dispatch, token]);

  useEffect(() => {
    if (activeTab === 'know') {
      loadRequested();
    }
  }, [activeTab, loadRequested]);

  const rows = useMemo(() => {
    return requested.map(chat => ({
      summary: mapChatItemToSummary(chat, localUser),
      raw: chat,
    }));
  }, [requested, localUser]);

  const onAccept = async (chatId: string) => {
    if (!token) return;
    setAcceptingId(chatId);
    try {
      const ok = await acceptHopenityChatRequest(chatId, token);
      if (ok) {
        await Promise.all([loadRequested(), reloadConversations()]);
      }
    } finally {
      setAcceptingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ArrowLeft size={22} color={C.textPrimary} />
        </TouchableOpacity>

        <Text style={styles.navTitle}>Message requests</Text>

        <TouchableOpacity
          onPress={() => {
            Alert.alert('Message Requests', 'What would you like to do?', [
              {
                text: 'Delete all requests',
                style: 'destructive',
                onPress: () => {
                  Alert.alert('Delete all', 'This will remove all pending message requests.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => setRequested([]) },
                  ]);
                },
              },
              { text: 'Cancel', style: 'cancel' },
            ]);
          }}
        >
          <MoreVertical size={22} color={C.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabBar}>
        {(['know', 'spam'] as const).map(tab => (
          <TouchableOpacity key={tab} style={styles.tab} onPress={() => setActiveTab(tab)}>
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'know' ? 'YOU MAY KNOW' : 'SPAM'}
            </Text>
            {activeTab === tab && <View style={styles.tabIndicator} />}
          </TouchableOpacity>
        ))}
      </View>

      {loading && activeTab === 'know' ? (
        <View style={styles.loading}>
          <ActivityIndicator size="small" color={C.primary} />
        </View>
      ) : null}

      {!token ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>Sign in to see message requests.</Text>
        </View>
      ) : activeTab === 'spam' ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>
            Spam and filtered requests will appear here. Nothing to show yet.
          </Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.infoBanner}>
            <Text style={styles.infoText}>
              Open a chat to learn more about who sent it. Tap Accept on a row to move
              the conversation into your inbox.
              <Text style={styles.link}> Settings</Text>
            </Text>
          </View>

          {rows.length === 0 && !loading ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>No pending message requests.</Text>
            </View>
          ) : null}

          {rows.map((row, index) => {
            const busy = acceptingId === row.summary.id;
            const lastTs =
              row.raw.messages?.[0]?.createdAt ??
              row.raw.messages?.[0]?.created_at;
            const secondaryTime = formatChatTime(lastTs);
            return (
              <React.Fragment key={row.summary.id}>
                <View style={styles.item}>
                  {row.summary.avatarUrl ? (
                    <FastImage
                      source={{ uri: row.summary.avatarUrl }}
                      style={styles.avatar}
                    />
                  ) : (
                    <View style={[styles.avatar, styles.avatarInitialWrap]}>
                      <Text style={styles.avatarInitial}>
                        {(row.summary.name ?? '?').trim().charAt(0).toUpperCase() ||
                          '?'}
                      </Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={styles.itemContent}
                    onLongPress={() => {
                      Alert.alert(row.summary.name, 'Choose an action', [
                        {
                          text: 'Accept',
                          onPress: () => onAccept(row.summary.id),
                        },
                        {
                          text: 'Delete request',
                          style: 'destructive',
                          onPress: () => setRequested(prev => prev.filter(c => String(c.id) !== row.summary.id)),
                        },
                        { text: 'Cancel', style: 'cancel' },
                      ]);
                    }}
                    onPress={() =>
                      navigation.navigate('Inbox', {
                        conversationId: row.summary.id,
                        displayName: row.summary.name,
                        avatarUrl: row.summary.avatarUrl,
                        liveKitRoom: resolveLiveKitRoomName({
                          conversationId: row.summary.id,
                          peerUserId: row.summary.peerUserId,
                          localUserId: localUser._id,
                          isGroup: row.summary.isGroup,
                        }),
                        seedConversation: { ...row.summary, messages: [] },
                      })
                    }
                  >
                    <Text style={styles.itemName}>{row.summary.name}</Text>
                    <Text style={styles.itemMsg}>
                      {row.summary.preview ||
                        row.raw.messages?.[0]?.content ||
                        'Message request'}{' '}
                      {secondaryTime ? (
                        <Text style={styles.itemTime}>· {secondaryTime}</Text>
                      ) : null}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.acceptPill, busy && styles.acceptPillDisabled]}
                    onPress={() => onAccept(row.summary.id)}
                    disabled={busy}
                  >
                    {busy ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.acceptPillLabel}>Accept</Text>
                    )}
                  </TouchableOpacity>
                </View>

                {index < rows.length - 1 ? <View style={styles.divider} /> : null}
              </React.Fragment>
            );
          })}

          <View style={{ height: 30 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

export default MessageRequestsScreen;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.background },
  loading: { paddingVertical: 12 },
  emptyWrap: { paddingHorizontal: 24, paddingVertical: 24 },
  emptyText: { color: C.textSecondary, fontSize: 14, textAlign: 'center' },

  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  navTitle: {
    color: C.textPrimary,
    fontSize: 18,
    fontWeight: '600',
  },

  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 13,
  },
  tabText: {
    color: C.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    color: C.textPrimary,
    fontWeight: '700',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 16,
    right: 16,
    height: 2.5,
    backgroundColor: C.textPrimary,
  },

  infoBanner: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  infoText: {
    color: C.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  link: {
    color: C.primary,
    fontWeight: '500',
  },

  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  itemContent: { flex: 1 },
  itemName: {
    color: C.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  itemMsg: {
    color: C.textSecondary,
    fontSize: 13,
  },
  itemTime: {
    color: C.textSecondary,
    fontSize: 13,
  },

  divider: {
    height: 1,
    backgroundColor: C.border,
    marginLeft: 88,
  },

  acceptPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: C.primary,
    minWidth: 72,
    alignItems: 'center',
  },
  acceptPillDisabled: { opacity: 0.65 },
  acceptPillLabel: { color: '#fff', fontWeight: '700', fontSize: 13 },
  avatarInitialWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.primary,
  },
  avatarInitial: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});
