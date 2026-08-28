import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DeviceEventEmitter,
  View,
  Text,
  Image,
  FlatList,
  ScrollView,
  StyleSheet,
  Alert,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IC_PROFILE } from '../assets';
import Header from '../components/home/Header';
import StoryItem from '../components/home/StoryItem';
import ConversationItem from '../components/home/ConversationItem';
import SearchBar from '../components/home/SearchBar';
import { colors, spacing, fonts } from '../theme';
import { useColors } from '../hooks/useColors';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import {
  BottomTabNavigatorParamList,
  RootStackNavigatorParamList,
} from '../types/navigators';
import { CompositeScreenProps } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PlayCircle } from 'lucide-react-native';
import { useChats, RELOAD_CHAT_LIST_EVENT } from '../context/ChatsContext';
import type { ConversationSummary } from '../context/ChatsContext';
import { useFocusEffect } from '@react-navigation/native';
import FastImage from '@d11/react-native-fast-image';
import { setStoryFeedRings } from '../data/storyFeedCache';
import { fetchMyFriends, type HopenityFriend } from '../services/friendsService';
import { storyRingsFromConversations } from '../services/story/buildStoryRings';
import {
  conversationHasStoryRing,
  isDmEligibleForStoryStrips,
} from '../services/story/storyStripEligibility';

import { useAppSelector, useAppDispatch } from '../hooks/redux';
import {
  selectHopenityProfile,
  setActivePage,
} from '../redux/features/auth/authSlice';
import { useT } from '../hooks/useT';
import { fetchMyBookings } from '../services/premiumCallService';
import { normalizeChatUserId } from '../utils/chatUserId';
import { resolveLiveKitRoomName } from '../utils/livekitRoomId';
import {
  consumePendingPeerLink,
  onPeerDeepLink,
  type PeerLinkPayload,
} from '../services/peerDeepLink';
import { getOrCreatePeerChat } from '../services/chatService';

type Props = CompositeScreenProps<
  BottomTabScreenProps<BottomTabNavigatorParamList, 'Home'>,
  NativeStackScreenProps<RootStackNavigatorParamList, 'Search'>
>;

type ChatFilter = 'all' | 'unread' | 'friends';

/**
 * Tabs are a mix of in-place filters and shortcuts: Booking and Requests own
 * full screens already, so tapping them navigates instead of filtering.
 */
type ChatTab =
  | { key: ChatFilter; label: string; kind: 'filter' }
  | { key: 'booking' | 'requests'; label: string; kind: 'route' };

const TABS: ChatTab[] = [
  { key: 'all', label: 'All', kind: 'filter' },
  { key: 'unread', label: 'Unread', kind: 'filter' },
  { key: 'booking', label: 'Booking', kind: 'route' },
  { key: 'requests', label: 'Requests', kind: 'route' },
  { key: 'friends', label: 'Friends', kind: 'filter' },
];

const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const colorss = useColors();
  const t = useT();
  const dispatch = useAppDispatch();
  const giftedChatUser = useAppSelector(s => s.auth.giftedChatUser);
  const token = useAppSelector(s => s.auth.token);
  const profile = useAppSelector(selectHopenityProfile);
  const localUserId = useMemo(
    () =>
      normalizeChatUserId(giftedChatUser?._id) ||
      normalizeChatUserId(profile?.userId) ||
      '',
    [giftedChatUser, profile],
  );

  const {
    conversations,
    reloadConversations,
    listLoading,
    loadingMoreConversations,
    loadMoreConversations,
    pendingRequestCount,
  } = useChats();
  const activePage = useAppSelector(state => state.auth.activePage);

  // Pull-to-refresh only. Background reloads (tab focus, page switch) used to
  // drive the same RefreshControl, so simply switching tabs threw a spinner in
  // and pushed the whole list down — a visible jolt on every navigation.
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const handleManualRefresh = useCallback(async () => {
    setManualRefreshing(true);
    try {
      await reloadConversations();
    } finally {
      setManualRefreshing(false);
    }
  }, [reloadConversations]);

  // ── Active booking banner ─────────────────────────────────────────────────
  const [activeBookingCount, setActiveBookingCount] = useState(0);

  // ── Chat list filter tabs ─────────────────────────────────────────────────
  const [activeFilter, setActiveFilter] = useState<ChatFilter>('all');
  const [friends, setFriends] = useState<HopenityFriend[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  /** null until the first page lands; false once the server runs out. */
  const [friendsHasMore, setFriendsHasMore] = useState(true);

  useFocusEffect(
    useCallback(() => {
      reloadConversations().catch(() => undefined);

      // Fetch active bookings (both as caller and callee) in the background.
      if (!token) return undefined;
      const ACTIVE = new Set(['PENDING', 'CONFIRMED', 'IN_CALL']);
      Promise.all([
        fetchMyBookings('caller', token).catch(() => []),
        fetchMyBookings('callee', token).catch(() => []),
      ]).then(([booked, received]) => {
        const active = [...booked, ...received].filter(b => ACTIVE.has(b.status));
        setActiveBookingCount(active.length);
      });

      return undefined;
    }, [reloadConversations, token]),
  );

  const directChats = useMemo(() => {
    const rows = conversations.filter(c => !c.isGroup);
    const byId = new Map<string, ConversationSummary>();
    for (const c of rows) {
      byId.set(String(c.id), c);
    }
    return [...byId.values()];
  }, [conversations]);

  const onlineFirst = useCallback(
    (a: ConversationSummary, b: ConversationSummary) => {
      const ao = a.isOnline === true ? 1 : 0;
      const bo = b.isOnline === true ? 1 : 0;
      if (ao !== bo) {
        return bo - ao;
      }
      return a.name.localeCompare(b.name, undefined, {
        sensitivity: 'base',
      });
    },
    [],
  );

  const activePeers = useMemo(
    () =>
      directChats
        .filter(c => isDmEligibleForStoryStrips(c) && c.isOnline === true)
        .sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
        ),
    [directChats],
  );

  const friendsStrip = useMemo(
    () =>
      directChats
        .filter(
          c => isDmEligibleForStoryStrips(c) && conversationHasStoryRing(c),
        )
        .sort(onlineFirst),
    [directChats, onlineFirst],
  );

  const toStoryShape = useCallback((c: ConversationSummary) => {
    const firstName = c.name.trim().split(/\s+/)[0];
    return {
      id: `story_${c.id}`,
      name: firstName || c.name,
      emoji: c.emoji,
      avatarUrl: c.avatarUrl ?? null,
      bgFrom: c.bgFrom ?? '#2d1060',
      bgTo: c.bgTo ?? '#5b21b6',
      active: c.isOnline === true,
    };
  }, []);

  const navigateInbox = useCallback(
    (item: ConversationSummary) => {
      navigation.navigate('Inbox', {
        conversationId: item.id,
        displayName: item.name,
        avatarUrl: item.avatarUrl ?? undefined,
        liveKitRoom: resolveLiveKitRoomName({
          conversationId: item.id,
          peerUserId: item.peerUserId,
          localUserId,
          isGroup: item.isGroup,
        }),
      });
    },
    [navigation, localUserId],
  );

  // Open or create a 1-to-1 chat for a hopechat://peer/{userId} deep link.
  // For existing conversations: navigate immediately with the real conversationId.
  // For new conversations: call POST /api/v1/chats to get or create a real
  // conversationId before navigating (same pattern as FB Messenger — thread is
  // provisioned server-side so InboxScreen has a valid ID from the first render).
  const navigateInboxForPeer = useCallback(
    async ({ peerId, displayName, avatarUrl, chatId, senderPageId, senderPageName, senderPageImage, targetPageId }: PeerLinkPayload) => {
      // In page mode the current conversations list holds personal chats, not page
      // chats — skip the local lookup and always provision via the API so the
      // conversation is stored with the correct page identity on the server.
      // Same when TARGETING a page: peerId is the page owner's userId, so the
      // local lookup would wrongly match a personal chat with the owner instead
      // of the page conversation — always resolve via the API.
      const existing = senderPageId || targetPageId
        ? undefined
        : conversations.find(
            c =>
              !c.isGroup &&
              c.peerUserId != null &&
              normalizeChatUserId(c.peerUserId) === normalizeChatUserId(peerId),
          );

      let conversationId: string;
      if (existing) {
        conversationId = String(existing.id);
      } else if (chatId && !senderPageId && !targetPageId) {
        conversationId = chatId;
      } else {
        const realId = token
          ? await getOrCreatePeerChat(peerId, token, senderPageId ?? undefined, targetPageId ?? undefined)
          : null;
        conversationId = realId ?? peerId;
        // Switch to page mode AFTER the chat is provisioned on the server so
        // the inbox reload (triggered by activePage change) can immediately
        // find the new conversation — avoids the race where reload runs before
        // the chat row exists in the DB.
        if (senderPageId) {
          dispatch(setActivePage({
            id: senderPageId,
            name: senderPageName ?? '',
            image: senderPageImage ?? null,
          }));
        }
        // Belt-and-suspenders: emit reload event so the inbox refreshes even
        // if the activePage dep-chain doesn't retrigger fast enough.
        DeviceEventEmitter.emit(RELOAD_CHAT_LIST_EVENT);
      }

      // Build a reliable seed so InboxScreen always has the peer's info even
      // before the conversation row appears in the chat list.
      const seed = existing ?? {
        id: conversationId,
        name: displayName ?? '',
        avatarUrl: avatarUrl ?? null,
        peerUserId: peerId,
        isGroup: false,
        // New conversations start as REQUESTED — the banner will guide the
        // recipient through acceptance.  The sender can write freely.
        needsAcceptance: false,
        preview: '',
        time: '',
        unreadCount: 0,
        messages: [],
      };

      navigation.navigate('Inbox', {
        conversationId,
        displayName: displayName ?? existing?.name ?? '',
        avatarUrl: avatarUrl ?? existing?.avatarUrl ?? null,
        liveKitRoom: resolveLiveKitRoomName({
          conversationId,
          peerUserId: peerId,
          localUserId,
        }),
        seedConversation: seed,
      });
    },
    [navigation, conversations, localUserId, token, dispatch],
  );

  // Runtime deep link — app already running / backgrounded.
  useEffect(() => {
    return onPeerDeepLink(payload => navigateInboxForPeer(payload));
  }, [navigateInboxForPeer]);

  // Cold-start deep link — wait for the list to finish loading, then consume.
  useEffect(() => {
    if (listLoading) return;
    const payload = consumePendingPeerLink();
    if (!payload) return;
    navigateInboxForPeer(payload);
  }, [listLoading, navigateInboxForPeer]);

  const openStoryViewer = useCallback(() => {
    const rings = storyRingsFromConversations(conversations);
    if (rings.length === 0) {
      Alert.alert(t.stories_title, t.no_stories_chats);
      return;
    }
    setStoryFeedRings(rings);

    const parentNav = navigation.getParent();
    if (parentNav) {
      (
        parentNav as { navigate: (n: string, p: object) => void }
      ).navigate('StoryViewer', { ringIndex: 0 });
    }
  }, [conversations, navigation]);

  /** Open the viewer positioned on one specific friend's ring. */
  const openStoryViewerFor = useCallback(
    (conversationId: string) => {
      const rings = storyRingsFromConversations(conversations);
      if (rings.length === 0) {
        Alert.alert(t.stories_title, t.no_stories_chats);
        return;
      }
      setStoryFeedRings(rings);

      // friendsStrip is sorted online-first while rings keep conversation
      // order, so resolve by id rather than trusting the tapped index.
      const idx = rings.findIndex(r => String(r.id) === String(conversationId));

      const parentNav = navigation.getParent();
      if (parentNav) {
        (
          parentNav as { navigate: (n: string, p: object) => void }
        ).navigate('StoryViewer', { ringIndex: idx >= 0 ? idx : 0 });
      }
    },
    [conversations, navigation, t.no_stories_chats, t.stories_title],
  );

  /** "Your story" tile — own avatar with a + badge, opens the composer. */
  const myStoryTile = useMemo(
    () => ({
      isAdd: true as const,
      id: 'my_story',
      name: 'Your story',
      avatarUrl: profile?.avatarUrl ?? null,
    }),
    [profile?.avatarUrl],
  );

  const openCreateStory = useCallback(() => {
    const parentNav = navigation.getParent();
    const target = (parentNav ?? navigation) as {
      navigate: (n: string) => void;
    };
    target.navigate('CreateStory');
  }, [navigation]);

  const renderStoryViewerTile = useCallback(
    () => (
      <TouchableOpacity
        style={styles.storyViewerTile}
        onPress={openStoryViewer}
        accessibilityRole="button"
        accessibilityLabel="Open stories viewer"
      >
        <PlayCircle size={28} color={colorss.primary} />
        <Text style={styles.storyViewerLabel}>{t.stories}</Text>
      </TouchableOpacity>
    ),
    [openStoryViewer],
  );

  const renderConversation = useCallback(
    ({ item }: { item: ConversationSummary }) => (
      <ConversationItem
        item={{ ...item, pinned: !!item.pinned }}
        onPress={() => navigateInbox(item)}
        onLongPress={() =>
          navigation.navigate('ConversationAction', {
            conversationId: item.id,
            conversationName: item.name,
            isGroup: !!item.isGroup,
            isV1Chat: item.isV1Chat,
            isMuted: false,
            isPinned: !!item.pinned,
            peerUserId: item.peerUserId ?? undefined,
          })
        }
      />
    ),
    [navigation, navigateInbox],
  );

  const unreadChatCount = useMemo(
    () => conversations.filter(c => (c.unreadCount ?? 0) > 0).length,
    [conversations],
  );

  // Switching into page mode hides the Friends tab; don't strand the user on
  // a filter whose chip is no longer there.
  useEffect(() => {
    if (activePage && activeFilter === 'friends') setActiveFilter('all');
  }, [activePage, activeFilter]);

  const filteredConversations = useMemo(() => {
    switch (activeFilter) {
      case 'unread':
        return conversations.filter(c => (c.unreadCount ?? 0) > 0);
      default:
        return conversations;
    }
  }, [activeFilter, conversations]);

  const FRIENDS_PAGE_SIZE = 30;

  /**
   * Friends load a page at a time and append on scroll. Guarded by a loading
   * flag so onEndReached — which fires repeatedly while the list settles —
   * can't stack duplicate requests for the same offset.
   */
  const loadFriends = useCallback(
    async (reset: boolean) => {
      const myId = normalizeChatUserId(profile?.userId);
      if (!myId || friendsLoading) return;
      if (!reset && !friendsHasMore) return;

      setFriendsLoading(true);
      try {
        const offset = reset ? 0 : friends.length;
        const page = await fetchMyFriends(myId, token, {
          limit: FRIENDS_PAGE_SIZE,
          offset,
        });

        setFriends(prev => {
          const next = reset ? page.friends : [...prev, ...page.friends];
          // The endpoint can repeat rows across pages when the underlying
          // order shifts; dedupe so keys stay unique and nobody appears twice.
          const seen = new Set<string>();
          return next.filter(f =>
            seen.has(f.userId) ? false : (seen.add(f.userId), true),
          );
        });

        const received = offset + page.friends.length;
        setFriendsHasMore(
          page.friends.length >= FRIENDS_PAGE_SIZE &&
            (page.total == null || received < page.total),
        );
      } finally {
        setFriendsLoading(false);
      }
    },
    [friends.length, friendsHasMore, friendsLoading, profile?.userId, token],
  );

  // First page loads when the tab is opened.
  useEffect(() => {
    if (activeFilter !== 'friends') return;
    if (friends.length > 0 || friendsLoading) return;
    void loadFriends(true);
  }, [activeFilter, friends.length, friendsLoading, loadFriends]);

  const openFriendChat = useCallback(
    (friend: HopenityFriend) => {
      void navigateInboxForPeer({
        peerId: friend.userId,
        displayName: friend.name,
        avatarUrl: friend.avatarUrl ?? undefined,
      });
    },
    [navigateInboxForPeer],
  );

  // The Stories row always renders — it holds the user's own "Your story" tile.
  const showStoryStrips = true;

  const ListHeader = useCallback(
    () => (
      <>
        {/* {showStoryStrips ? (
          <>
            {activePeers.length > 0 ? (
              <View style={styles.storySection}>
                <Text style={styles.stripSectionLabel}>{t.active}</Text>
                <View style={styles.storyStripRow}>
                  <FlatList
                    data={activePeers}
                    renderItem={({ item }) => (
                      <StoryItem
                        item={toStoryShape(item)}
                        onPress={() => navigateInbox(item)}
                      />
                    )}
                    keyExtractor={item => `active_${item.id}`}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.storyStripFlex}
                    contentContainerStyle={styles.storiesListInner}
                  />
                  {renderStoryViewerTile()}
                </View>
              </View>
            ) : null} */}

            {/* <View style={styles.storySection}>
              <Text style={styles.stripSectionLabel}>{t.stories}</Text>
              <View style={styles.storyStripRow}>
                <StoryItem item={myStoryTile} onPress={openCreateStory} />
                <FlatList
                  data={friendsStrip}
                  renderItem={({ item }) => (
                    <StoryItem
                      item={toStoryShape(item)}
                      onPress={() => openStoryViewerFor(item.id)}
                    />
                  )}
                  keyExtractor={item => `friend_${item.id}`}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.storyStripFlex}
                  contentContainerStyle={styles.storiesListInner}
                />
              </View>
            </View>
          </>
        ) : null} */}

        {/* ── Filter tabs ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {TABS.filter(
            // A page has no friends of its own — the list would be the
            // operator's personal friends, which is not what page mode means.
            tab => !(activePage && tab.key === 'friends'),
          ).map(tab => {
            const selected = tab.kind === 'filter' && activeFilter === tab.key;
            const badge =
              tab.key === 'requests'
                ? pendingRequestCount
                : tab.key === 'unread'
                  ? unreadChatCount
                  : 0;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => {
                  if (tab.kind === 'route') {
                    navigation.navigate(
                      tab.key === 'booking' ? 'MyBookings' : 'MessageRequests',
                    );
                    return;
                  }
                  setActiveFilter(tab.key);
                }}
                style={[styles.filterChip, selected && styles.filterChipOn]}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selected && styles.filterChipTextOn,
                  ]}
                >
                  {tab.label}
                </Text>
                {badge > 0 ? (
                  <View
                    style={[
                      styles.chipBadge,
                      selected && styles.chipBadgeOnSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipBadgeText,
                        selected && styles.chipBadgeTextOnSelected,
                      ]}
                    >
                      {badge > 99 ? '99+' : badge}
                    </Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Active booking banner ── */}
        {activeBookingCount > 0 ? (
          <TouchableOpacity
            style={styles.bookingBanner}
            onPress={() => navigation.navigate('MyBookings')}
            activeOpacity={0.85}
          >
            <Image
              source={IC_PROFILE}
              style={styles.bookingAvatar}
              resizeMode="cover"
            />
            <View style={styles.bookingBannerText}>
              <Text style={styles.bookingTitle} numberOfLines={1}>
                Hopechat Booking
              </Text>
              <Text style={styles.bookingSub} numberOfLines={1}>
                {activeBookingCount === 1
                  ? 'You have 1 active booking'
                  : `You have ${activeBookingCount} active bookings`}
              </Text>
            </View>
          </TouchableOpacity>
        ) : null}

      </>
    ),
    [
      activeBookingCount,
      activePage,
      activePeers,
      friendsStrip,
      activeFilter,
      myStoryTile,
      navigateInbox,
      navigation,
      openCreateStory,
      openStoryViewerFor,
      pendingRequestCount,
      unreadChatCount,
      renderStoryViewerTile,
      showStoryStrips,
      toStoryShape,
    ],
  );

  const styles = useMemo(() => StyleSheet.create({
    filterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 20,
      paddingTop: 4,
      paddingBottom: 10,
    },
    filterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: colorss.bubbleIn,
    },
    chipBadge: {
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 5,
      backgroundColor: colorss.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipBadgeOnSelected: {
      backgroundColor: '#FFFFFF',
    },
    chipBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    chipBadgeTextOnSelected: {
      color: colorss.primary,
    },
    filterChipOn: {
      backgroundColor: colorss.primary,
    },
    filterChipText: {
      fontSize: 13,
      fontWeight: '600',
      color: colorss.textPrimary,
    },
    filterChipTextOn: {
      color: '#FFFFFF',
    },
    friendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 20,
      paddingVertical: 8,
    },
    friendAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colorss.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    friendInitial: {
      color: '#FFFFFF',
      fontSize: 17,
      fontWeight: '700',
    },
    friendsFooter: {
      paddingVertical: 16,
    },
    friendName: {
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
      color: colorss.textPrimary,
    },
    safeArea: {
      flex: 1,
      backgroundColor: colorss.white,
    },
    container: {
      flex: 1,
      backgroundColor: colorss.white,
    },
    // Styled to match ConversationItem so it reads as the first chat row,
    // not a banner bolted above the list.
    bookingBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 20,
      paddingVertical: 8,
    },
    bookingAvatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
    },
    bookingBannerText: {
      flex: 1,
      minWidth: 0,
    },
    bookingTitle: {
      fontSize: 15,
      fontWeight: fonts.semibold,
      color: colorss.textPrimary,
      marginBottom: 3,
    },
    bookingSub: {
      fontSize: 13,
      color: colorss.textSecondary,
    },
    storySection: {
      paddingBottom: 4,
    },
    stripSectionLabel: {
      fontSize: 13,
      fontWeight: fonts.semibold,
      color: colorss.textSecondary,
      paddingHorizontal: spacing.xl,
      paddingTop: 6,
      paddingBottom: 6,
    },
    storyStripRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingLeft: spacing.xl,
      paddingRight: 8,
      gap: 8,
    },
    storyStripFlex: {
      flexGrow: 1,
      flexShrink: 1,
      minWidth: 0,
    },
    storiesListInner: {
      paddingVertical: 10,
      paddingRight: 8,
      gap: 12,
    },
    storyViewerTile: {
      width: 64,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 10,
      paddingBottom: 4,
      gap: 4,
    },
    storyViewerLabel: {
      fontSize: 10,
      fontWeight: fonts.semibold,
      color: colorss.primary,
      textAlign: 'center',
    },
    messagesHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 8,
    },
    messagesHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    requestsPillRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    requestsLabel: {
      color: colorss.primary,
    },
    sectionLabel: {
      fontSize: 14,
      fontWeight: fonts.semibold,
      color: colorss.textPrimary,
      letterSpacing: 0.08 * 11,
    },
    listContent: {
      flexGrow: 1,
      paddingBottom: 8,
    },
    emptyState: {
      alignItems: 'center',
      paddingTop: 40,
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: 14,
    },
    requestBadge: {
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      paddingHorizontal: 6,
      backgroundColor: colorss.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    requestBadgeText: {
      color: '#fff',
      fontSize: 11,
      fontWeight: '700' as const,
    },
  }), [colorss]);

  const renderFriend = useCallback(
    ({ item }: { item: HopenityFriend }) => (
      <TouchableOpacity
        style={styles.friendRow}
        onPress={() => openFriendChat(item)}
        activeOpacity={0.7}
      >
        {item.avatarUrl ? (
          <FastImage
            source={{ uri: item.avatarUrl }}
            style={styles.friendAvatar}
          />
        ) : (
          <View style={styles.friendAvatar}>
            <Text style={styles.friendInitial}>
              {item.name.trim().charAt(0).toUpperCase() || '?'}
            </Text>
          </View>
        )}
        <Text style={styles.friendName} numberOfLines={1}>
          {item.name}
        </Text>
      </TouchableOpacity>
    ),
    [openFriendChat, styles.friendAvatar, styles.friendInitial, styles.friendName, styles.friendRow],
  );


  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <Header
        onCamera={() => navigation.navigate('CreateStory')}
        onNewGroup={() => navigation.navigate('NewGroup')}
      />
      <SearchBar onSearchPress={() => navigation.navigate('Search')} />
      <View style={styles.container}>
        {activeFilter === 'friends' ? (
          <FlatList<HopenityFriend>
            data={friends}
            renderItem={renderFriend}
            keyExtractor={item => `friend_${item.userId}`}
            ListHeaderComponent={ListHeader}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            onEndReached={() => void loadFriends(false)}
            onEndReachedThreshold={0.4}
            refreshControl={
              <RefreshControl
                refreshing={friendsLoading && friends.length === 0}
                onRefresh={() => void loadFriends(true)}
              />
            }
            ListFooterComponent={
              friendsLoading && friends.length > 0 ? (
                <ActivityIndicator
                  style={styles.friendsFooter}
                  color={colorss.primary}
                />
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  {friendsLoading ? '…' : 'No friends found.'}
                </Text>
              </View>
            }
          />
        ) : (
          <FlatList<ConversationSummary>
            data={filteredConversations}
            renderItem={renderConversation}
            keyExtractor={item => String(item.id)}
            extraData={filteredConversations}
            ListHeaderComponent={ListHeader}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            onEndReached={() => void loadMoreConversations()}
            onEndReachedThreshold={0.5}
            refreshControl={
              <RefreshControl
                refreshing={manualRefreshing}
                onRefresh={handleManualRefresh}
              />
            }
            ListFooterComponent={
              loadingMoreConversations ? (
                <ActivityIndicator
                  style={styles.friendsFooter}
                  color={colorss.primary}
                />
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  {activeFilter === 'all'
                    ? t.no_conversations
                    : 'Nothing here yet.'}
                </Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
};

export default HomeScreen;
