import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Unlock, UserX } from 'lucide-react-native';
import FastImage from '@d11/react-native-fast-image';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colorss } from '../theme';
import { IC_PROFILE } from '../assets';
import type { RootStackNavigatorParamList } from '../types/navigators';
import { useAppSelector } from '../hooks/redux';
import {
  selectAuthToken,
  selectHopenityProfile,
} from '../redux/features/auth/authSlice';
import {
  fetchHopenityChatDirectory,
  unblockHopeChatUser,
} from '../services/chatService';
import { mapChatItemToSummary } from '../context/ChatsContext';
import { normalizeChatUserId } from '../utils/chatUserId';
import { useT } from '../hooks/useT';

type Props = NativeStackScreenProps<RootStackNavigatorParamList, 'BlockedPeople'>;

const BlockedPeopleScreen: React.FC<Props> = ({ navigation }) => {
  const t = useT();
  const token = useAppSelector(selectAuthToken);
  const profile = useAppSelector(selectHopenityProfile);
  const giftedChatUser = useAppSelector(s => s.auth.giftedChatUser);

  const localUser = useMemo(
    () => ({
      _id:
        normalizeChatUserId(giftedChatUser?._id) ||
        normalizeChatUserId(profile?.userId) ||
        'me',
      name: giftedChatUser?.name ?? profile?.displayName ?? 'You',
    }),
    [giftedChatUser, profile],
  );

  const [blocked, setBlocked] = useState<ReturnType<typeof mapChatItemToSummary>[]>([]);
  const [loading, setLoading] = useState(true);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    setLoading(true);
    try {
      const { chats } = await fetchHopenityChatDirectory(token, {
        status: 'blocked',
        limit: 100,
      });
      setBlocked(chats.map(c => mapChatItemToSummary(c, localUser)));
    } catch {
      setBlocked([]);
    } finally {
      setLoading(false);
    }
  }, [token, localUser]);

  useEffect(() => { void load(); }, [load]);

  const handleUnblock = useCallback((item: ReturnType<typeof mapChatItemToSummary>) => {
    Alert.alert(
      `${t.unblock} ${item.name}?`,
      `${item.name} will be able to message and call you again.`,
      [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.unblock,
          onPress: async () => {
            setUnblockingId(item.id);
            try {
              await unblockHopeChatUser(item.id, token);
              setBlocked(prev => prev.filter(b => b.id !== item.id));
            } catch {
              Alert.alert('Error', 'Could not unblock. Please try again.');
            } finally {
              setUnblockingId(null);
            }
          },
        },
      ],
    );
  }, [token]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color={colorss.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{t.blocked_people_title}</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colorss.primary} size="large" />
        </View>
      ) : blocked.length === 0 ? (
        <View style={styles.center}>
          <UserX size={48} color={colorss.placeholder} />
          <Text style={styles.emptyTitle}>{t.blocked_empty_title}</Text>
          <Text style={styles.emptyBody}>{t.blocked_empty_body}</Text>
        </View>
      ) : (
        <>
          <Text style={styles.count}>
            {blocked.length} {blocked.length === 1 ? t.blocked_count_one : t.blocked_count_many}
          </Text>
          <FlatList
            data={blocked}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 32 }}
            ItemSeparatorComponent={() => <View style={styles.divider} />}
            renderItem={({ item }) => {
              const busy = unblockingId === item.id;
              return (
                <View style={styles.row}>
                  <FastImage
                    source={item.avatarUrl ? { uri: item.avatarUrl } : IC_PROFILE}
                    style={styles.avatar}
                  />
                  <View style={styles.nameCol}>
                    <Text style={styles.name} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.sub} numberOfLines={1}>
                      {t.blocked_label}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.unblockBtn, busy && styles.unblockBtnBusy]}
                    onPress={() => handleUnblock(item)}
                    disabled={busy}
                    accessibilityLabel={`${t.unblock} ${item.name}`}
                  >
                    {busy ? (
                      <ActivityIndicator size="small" color={colorss.primary} />
                    ) : (
                      <>
                        <Unlock size={14} color={colorss.primary} />
                        <Text style={styles.unblockLabel}>{t.unblock}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              );
            }}
          />
        </>
      )}
    </SafeAreaView>
  );
};

export default BlockedPeopleScreen;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colorss.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colorss.border,
  },
  backBtn: { padding: 4 },
  title: { fontSize: 18, fontWeight: '700', color: colorss.textPrimary },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colorss.textPrimary,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 14,
    color: colorss.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  count: {
    fontSize: 13,
    color: colorss.textSecondary,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  nameCol: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600', color: colorss.textPrimary },
  sub: { fontSize: 12, color: colorss.textSecondary, marginTop: 2 },
  divider: { height: 1, backgroundColor: colorss.border, marginLeft: 78 },
  unblockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1.5,
    borderColor: colorss.primary,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    minWidth: 90,
    justifyContent: 'center',
  },
  unblockBtnBusy: { opacity: 0.6 },
  unblockLabel: {
    color: colorss.primary,
    fontWeight: '700',
    fontSize: 13,
  },
});
