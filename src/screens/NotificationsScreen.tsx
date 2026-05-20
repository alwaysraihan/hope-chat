import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  Animated,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BellOff } from 'lucide-react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import FastImage from '@d11/react-native-fast-image';

import { colorss } from '../theme';
import { IC_PROFILE } from '../assets';
import type {
  BottomTabNavigatorParamList,
  RootStackNavigatorParamList,
} from '../types/navigators';
import { useAppSelector } from '../hooks/redux';
import { selectHopenityProfile } from '../redux/features/auth/authSlice';
import { readNotificationsCache, writeNotificationsCache } from '../services/offlineCache';
import { API_BASE_URL } from '../config/env';
import { useT } from '../hooks/useT';

type Props = CompositeScreenProps<
  BottomTabScreenProps<BottomTabNavigatorParamList, 'Notifications'>,
  NativeStackScreenProps<RootStackNavigatorParamList>
>;

// ─── Types ────────────────────────────────────────────────────────────────────

type NotifActor = {
  user_id?: string;
  name?: string;
  image?: string | null;
};

type NotifItem = {
  id: number;
  type: string;
  is_read: boolean;
  created_at: string;
  actor?: NotifActor;
  post?: { content?: string };
  comment?: { content?: string };
  friendship_status?: string;
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonBox({ width, height, borderRadius = 6, style }: {
  width: number | string; height: number; borderRadius?: number; style?: object;
}) {
  const opacity = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    a.start();
    return () => a.stop();
  }, [opacity]);
  return (
    <Animated.View
      style={[{ width, height, borderRadius, backgroundColor: colorss.backgroundDeep }, { opacity }, style]}
    />
  );
}

function SkeletonRow() {
  return (
    <View style={styles.item}>
      <SkeletonBox width={52} height={52} borderRadius={26} />
      <View style={{ flex: 1, gap: 8 }}>
        <SkeletonBox width="70%" height={14} />
        <SkeletonBox width="40%" height={11} />
      </View>
    </View>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return `${Math.floor(diff / 604800)}w`;
}

function notifMessage(n: NotifItem): string {
  const name = n.actor?.name ?? 'Someone';
  switch (n.type) {
    case 'POST_LIKE': return `${name} liked your post.`;
    case 'COMMENT': return `${name} commented on your post.`;
    case 'COMMENT_REPLY': return `${name} replied to your comment.`;
    case 'STORY_REACTION': return `${name} reacted to your story.`;
    case 'PAGE_FOLLOW': return `${name} followed your page.`;
    case 'FRIEND_REQUEST': return `${name} sent you a friend request.`;
    case 'FRIEND_REQUEST_ACCEPTED': return `${name} accepted your friend request.`;
    case 'MESSAGE': return `${name} sent you a message.`;
    case 'BLOOD_REQUEST': return `${name} posted a blood request.`;
    case 'DONATION_REQUEST': return `${name} made a donation request.`;
    case 'DONATION_ACCEPTED': return `Your donation was accepted by ${name}.`;
    case 'DONATION_REJECTED': return `Your donation was declined by ${name}.`;
    case 'POST_UPLOAD_QUEUED': return 'Your post is being uploaded.';
    case 'POST_PUBLISHED': return 'Your post has been published.';
    case 'POST_BLOCKED': return 'Your post was removed for violating community guidelines.';
    case 'RECHARGE_APPROVED': return 'Your recharge request was approved.';
    case 'RECHARGE_DECLINED': return 'Your recharge request was declined.';
    case 'WITHDRAWAL_APPROVED': return 'Your withdrawal request was approved.';
    case 'WITHDRAWAL_REJECTED': return 'Your withdrawal request was rejected.';
    case 'VERIFICATION_APPROVED': return 'Your account has been verified.';
    case 'VERIFICATION_REJECTED': return 'Your verification request was rejected.';
    case 'DEVICE_APPROVAL_REQUEST': return 'A new device is requesting access to your account.';
    case 'AD_CAMPAIGN_ACTIVITY': return 'Your ad campaign has activity.';
    case 'AD_CAMPAIGN_COMPLETED': return 'Your ad campaign has completed.';
    case 'CONTEST_APPROVED': return 'Your contest entry was approved.';
    case 'CONTEST_REJECTED': return 'Your contest entry was rejected.';
    default: return `New notification from ${name}.`;
  }
}

function sectionLabel(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 86400) return 'Today';
  if (diff < 172800) return 'Yesterday';
  if (diff < 604800) return 'This week';
  return 'Earlier';
}

// ─── Filter ───────────────────────────────────────────────────────────────────

/** Types handled elsewhere (push notification tray / call UI) — hide from this screen. */
const HIDDEN_TYPES = new Set([
  'MESSAGE',
  'FRIEND_REQUEST',
  'FRIEND_REQUEST_ACCEPTED',
  'CALL',
  'MISSED_CALL',
  'INCOMING_CALL',
  'CALL_CANCELLED',
]);

function filterNotifications(list: NotifItem[]): NotifItem[] {
  return list.filter(n => !HIDDEN_TYPES.has((n.type ?? '').toUpperCase()));
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function apiFetch(url: string, token: string | null, init?: RequestInit) {
  return fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...((init?.headers as object) ?? {}),
    },
  });
}

async function loadNotifications(token: string | null): Promise<NotifItem[]> {
  const res = await apiFetch(
    `${API_BASE_URL}/api/v1/notifications?page=1&limit=50`,
    token,
  );
  const json = await res.json();
  const list = json?.responseObject ?? json?.data ?? json?.notifications ?? [];
  return Array.isArray(list) ? list : [];
}

async function markRead(id: number, token: string | null): Promise<void> {
  await apiFetch(
    `${API_BASE_URL}/api/v1/notifications/${id}/read`,
    token,
    { method: 'PATCH', body: '{}' },
  );
}

async function markAllRead(token: string | null): Promise<void> {
  await apiFetch(
    `${API_BASE_URL}/api/v1/notifications/read-all`,
    token,
    { method: 'PATCH', body: '{}' },
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

const NotificationsScreen: React.FC<Props> = () => {
  const t = useT();
  const token = useAppSelector(s => s.auth.token);
  const userId = useAppSelector(selectHopenityProfile)?.userId ?? 'me';

  const [items, setItems] = useState<NotifItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = filterNotifications(await loadNotifications(token));
      setItems(data);
      writeNotificationsCache(userId, data);
    } catch {
      /* keep existing list on error */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, userId]);

  // Restore cached notifications instantly before the network response arrives
  const cacheLoaded = useRef(false);
  useEffect(() => {
    if (cacheLoaded.current || userId === 'me') return;
    cacheLoaded.current = true;
    const cached = readNotificationsCache(userId);
    if (cached && cached.length > 0) {
      setItems(filterNotifications(cached as NotifItem[]));
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  // Auto-mark all unread notifications as read the moment the screen comes
  // into focus — no manual button needed.
  const hasUnread = useMemo(() => items.some(n => !n.is_read), [items]);
  useFocusEffect(
    useCallback(() => {
      if (!hasUnread) return;
      // Optimistically update UI first for instant feedback.
      setItems(prev => prev.map(n => ({ ...n, is_read: true })));
      // Persist to backend silently.
      markAllRead(token).catch(() => { /* silent */ });
    }, [hasUnread, token]),
  );

  const handlePress = useCallback((_item: NotifItem) => {
    // Messaging and call types are filtered out; add tap routing here for other types as needed.
  }, []);

  // ── Group by section label
  const grouped = useMemo(() => {
    const map = new Map<string, NotifItem[]>();
    const order: string[] = [];
    for (const n of items) {
      const sec = sectionLabel(n.created_at);
      if (!map.has(sec)) { map.set(sec, []); order.push(sec); }
      map.get(sec)!.push(n);
    }
    return order.map(sec => ({ section: sec, data: map.get(sec)! }));
  }, [items]);

  const renderItem = useCallback(({ item }: { item: NotifItem }) => (
    <TouchableOpacity
      style={[styles.item, !item.is_read && styles.itemUnread]}
      activeOpacity={0.75}
      onPress={() => handlePress(item)}
    >
      <View style={styles.avatarWrap}>
        <FastImage
          source={item.actor?.image ? { uri: item.actor.image } : IC_PROFILE}
          style={styles.avatar}
        />
        {!item.is_read && <View style={styles.unreadDot} />}
      </View>

      <View style={styles.itemBody}>
        <Text style={[styles.itemMsg, !item.is_read && styles.itemMsgUnread]} numberOfLines={2}>
          {notifMessage(item)}
        </Text>
        <Text style={[styles.itemTime, !item.is_read && styles.itemTimeUnread]}>
          {relativeTime(item.created_at)}
        </Text>
      </View>
    </TouchableOpacity>
  ), [handlePress]);

  // ── Skeleton ── (only when loading with no cached data to show)
  if (loading && items.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Text style={styles.title}>{t.notifications}</Text>
        </View>
        {[...Array(10)].map((_, i) => <SkeletonRow key={i} />)}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>{t.notifications}</Text>
      </View>

      {items.length === 0 ? (
        <View style={styles.empty}>
          <BellOff size={44} color={colorss.placeholder} />
          <Text style={styles.emptyText}>{t.no_notifications}</Text>
        </View>
      ) : (
        <FlatList
          data={grouped}
          keyExtractor={g => g.section}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 30 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void load(true)}
              tintColor={colorss.primary}
            />
          }
          renderItem={({ item: group }) => (
            <View>
              <Text style={styles.sectionLabel}>{group.section}</Text>
              {group.data.map(n => renderItem({ item: n }))}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
};

export default NotificationsScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colorss.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colorss.border,
  },
  title: {
    color: colorss.textPrimary,
    fontSize: 26,
    fontWeight: '700',
  },
  sectionLabel: {
    color: colorss.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 6,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  itemUnread: {
    backgroundColor: `${colorss.primary}18`,
    borderLeftWidth: 3,
    borderLeftColor: colorss.primary,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  unreadDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: colorss.primary,
    borderWidth: 2,
    borderColor: colorss.white,
  },
  itemBody: {
    flex: 1,
  },
  itemMsg: {
    fontSize: 14,
    color: colorss.textPrimary,
    lineHeight: 20,
  },
  itemMsgUnread: {
    fontWeight: '700',
  },
  itemTime: {
    fontSize: 12,
    color: colorss.textSecondary,
    marginTop: 4,
  },
  itemTimeUnread: {
    color: colorss.primary,
    fontWeight: '600',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyText: {
    color: colorss.textSecondary,
    fontSize: 15,
  },
});
