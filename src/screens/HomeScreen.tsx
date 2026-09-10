import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useChats, RELOAD_CHAT_LIST_EVENT } from '../context/ChatsContext';
import type { ConversationSummary } from '../context/ChatsContext';
import { useFocusEffect } from '@react-navigation/native';
import FastImage from '@d11/react-native-fast-image';
import { setStoryFeedRings, type StoryRing } from '../data/storyFeedCache';
import { fetchMyFriends, type HopenityFriend } from '../services/friendsService';
import { storyRingsFromConversations } from '../services/story/buildStoryRings';
import { fetchStoryFeed } from '../services/story/storyApi';
import { STORY_DELETED_EVENT, STORY_POSTED_EVENT } from '../services/story/storyEvents';
import {
  readStoryFeedCache,
  writeStoryFeedCache,
} from '../services/offlineCache';
import { isDmEligibleForStoryStrips } from '../services/story/storyStripEligibility';

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

  const onlinePeers = useMemo(
    () =>
      directChats
        .filter(c => isDmEligibleForStoryStrips(c) && c.isOnline === true)
        .sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
        ),
    [directChats],
  );

  /** Nobody's online right now — surface a few friends instead of hiding the row entirely. */
  const suggestedPeers = useMemo(
    () =>
      directChats
        .filter(isDmEligibleForStoryStrips)
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
        .slice(0, 8),
    [directChats],
  );

  const showingSuggestedPeers = onlinePeers.length === 0;
  const activePeers = showingSuggestedPeers ? suggestedPeers : onlinePeers;


  // ── Real story feed (same backend as the Stories tab) ─────────────────────
  // The tray used to fabricate rings from the conversation list (picsum.photos
  // placeholder images) — this pulls the actual GET /api/v1/stories feed so
  // the strip shows real stories, matching StoryScreen.tsx exactly.
  const userId = profile?.userId ?? 'me';
  const [apiRings, setApiRings] = useState<StoryRing[]>([]);
  const storyCacheLoaded = useRef(false);
  useEffect(() => {
    if (storyCacheLoaded.current || userId === 'me') return;
    storyCacheLoaded.current = true;
    const cached = readStoryFeedCache(userId);
    if (cached && cached.length > 0) setApiRings(cached);
  }, [userId]);

  const loadStoryFeed = useCallback(async () => {
    try {
      const fetched = await fetchStoryFeed(token);
      if (fetched.length > 0) {
        setApiRings(fetched);
        writeStoryFeedCache(userId, fetched);
      }
    } catch {
      /* keep whatever is already on screen */
    }
  }, [token, userId]);

  useEffect(() => {
    loadStoryFeed();
  }, [loadStoryFeed]);

  // A story deleted from the viewer only updated the viewer's own local
  // cache — this screen keeps an independent copy of the feed, so without
  // this it kept showing the deleted story until the next mount/focus
  // refetch (which itself silently no-ops on an empty result).
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(
      STORY_DELETED_EVENT,
      ({ storyId }: { storyId: string }) => {
        setApiRings(prev => {
          const next = prev
            .map(r => ({ ...r, slides: r.slides.filter(s => s.id !== storyId) }))
            .filter(r => r.slides.length > 0);
          if (userId !== 'me') writeStoryFeedCache(userId, next);
          return next;
        });
      },
    );
    return () => sub.remove();
  }, [userId]);

  // Mirrors the delete-sync effect above, for the opposite direction: a
  // freshly-posted story is merged in immediately instead of waiting for the
  // feed listing endpoint to catch up with what was just written.
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(
      STORY_POSTED_EVENT,
      ({ ring: posted }: { ring: StoryRing }) => {
        setApiRings(prev => {
          const existing = prev.find(r => r.id === posted.id);
          const next = existing
            ? prev.map(r =>
                r.id === posted.id
                  ? { ...r, slides: [...posted.slides, ...r.slides] }
                  : r,
              )
            : [posted, ...prev];
          if (userId !== 'me') writeStoryFeedCache(userId, next);
          return next;
        });
      },
    );
    return () => sub.remove();
  }, [userId]);

  // Pull-to-refresh previously only reloaded conversations, never the story
  // feed — if that one fetchStoryFeed() call on mount/focus silently failed
  // (fetchStoryFeed swallows its own errors and returns []), a newly-posted
  // story could be stuck missing from the strip indefinitely with no way to
  // retry short of leaving and re-entering the screen.
  const handleManualRefresh = useCallback(async () => {
    setManualRefreshing(true);
    try {
      await Promise.all([reloadConversations(), loadStoryFeed()]);
    } finally {
      setManualRefreshing(false);
    }
  }, [reloadConversations, loadStoryFeed]);

  useFocusEffect(
    useCallback(() => {
      loadStoryFeed().catch(() => {});
    }, [loadStoryFeed]),
  );

  const isMyRing = useCallback(
    (r: StoryRing) => {
      if (activePage) {
        const pageId = String(activePage.id);
        return !!r.isPage && (r.authorId === pageId || r.authorPublicId === pageId);
      }
      if (r.isPage) return false;
      // Two independent id spaces exist for "me" (numeric DB id vs public
      // user_id) and which one `profile.userId` resolves to isn't guaranteed
      // — localUserId already carries the same giftedChatUser._id-first
      // fallback used for every other "is this me" check in this file
      // (navigateInboxForPeer, etc.), so check both instead of trusting
      // profile.userId alone to have landed in the id space the story API
      // happens to compare against.
      const mine = new Set(
        [localUserId, profile?.userId].filter(Boolean).map(String),
      );
      return mine.has(String(r.authorId ?? '')) || mine.has(String(r.authorPublicId ?? ''));
    },
    [activePage, profile?.userId, localUserId],
  );

  /** Real API rings; fall back to conversation-derived placeholders only if the feed is empty. */
  const storyRings = useMemo(() => {
    if (apiRings.length > 0) return apiRings;
    return storyRingsFromConversations(conversations);
  }, [apiRings, conversations]);

  /** Everyone else's rings — "Your story" is its own fixed first tile, not part of this list. */
  const friendsRings = useMemo(
    () => storyRings.filter(r => !isMyRing(r)),
    [storyRings, isMyRing],
  );

  /** Your own active story, if you have one — drives whether the "Your story"
   * tile opens the viewer (Hopenity's pattern: tap avatar = view, tap the +
   * badge = add) or falls through to creating a new one. */
  const myRing = useMemo(() => storyRings.find(isMyRing), [storyRings, isMyRing]);

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
    async ({ peerId, displayName, avatarUrl, chatId, senderPageId, senderPageName, senderPageImage, targetPageId, share }: PeerLinkPayload) => {
      // A thread/<id> link carries no peerId — the chatId alone identifies the
      // conversation, so skip the peer lookup entirely and open it directly.
      if (!peerId && chatId) {
        navigation.navigate('Inbox', {
          conversationId: chatId,
          displayName: displayName ?? undefined,
          avatarUrl: avatarUrl ?? null,
          pendingShare: share ?? undefined,
        });
        return;
      }
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
        pendingShare: share ?? undefined,
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

  /** Open the viewer positioned on one specific ring (by ring id). */
  const openStoryViewerFor = useCallback(
    (ringId: string) => {
      if (storyRings.length === 0) {
        Alert.alert(t.stories_title, t.no_stories_chats);
        return;
      }
      setStoryFeedRings(storyRings);

      // friendsRings can be reordered/filtered relative to storyRings, so
      // resolve by id rather than trusting the tapped index.
      const idx = storyRings.findIndex(r => String(r.id) === String(ringId));

      const parentNav = navigation.getParent();
      if (parentNav) {
        (
          parentNav as { navigate: (n: string, p: object) => void }
        ).navigate('StoryViewer', { ringIndex: idx >= 0 ? idx : 0 });
      }
    },
    [storyRings, navigation, t.no_stories_chats, t.stories_title],
  );

  /** "Your story" tile — own avatar with a + badge, opens the composer. */
  // In Page mode, "My Story" must reflect the Page's identity — isMyRing
  // already branches on activePage to match/create page-owned rings, but
  // this tile's own avatar/name were always the personal profile regardless,
  // so posting/viewing looked like it was happening as you even while a
  // page was active.
  const myStoryTile = useMemo(
    () => ({
      isAdd: true as const,
      id: 'my_story',
      name: activePage ? activePage.name : 'My Story',
      avatarUrl: activePage?.image ?? profile?.avatarUrl ?? null,
    }),
    [activePage, profile?.avatarUrl],
  );

  const openCreateStory = useCallback(() => {
    const parentNav = navigation.getParent();
    const target = (parentNav ?? navigation) as {
      navigate: (n: string) => void;
    };
    target.navigate('CreateStory');
  }, [navigation]);

  /** Unified strip: "Your story" first, then active/suggested friends, then everyone's story rings. */
  const combinedStripItems = useMemo(() => {
    const items: Array<{
      id: string;
      name: string;
      avatarUrl?: string | null;
      isAdd?: boolean;
      active?: boolean;
      /** Has a live story — draws the ring border so it visibly reads as a story card. */
      hasStory?: boolean;
      /** All of that story's slides have been viewed — ring shows muted instead of bright. */
      storySeen?: boolean;
      onPress: () => void;
      onBadgePress?: () => void;
    }> = [
      {
        id: 'my_story',
        name: myStoryTile.name,
        avatarUrl: myStoryTile.avatarUrl,
        isAdd: true,
        hasStory: !!myRing,
        storySeen: myRing ? myRing.slides.every(s => s.isViewed) : false,
        // Whole card opens your existing story when you have one; the +
        // badge always opens the composer regardless. No separate second
        // card for "my story" — one tile does both jobs.
        onPress: myRing ? () => openStoryViewerFor(myRing.id) : openCreateStory,
        onBadgePress: openCreateStory,
      },
    ];
    // A friend who is both active/suggested AND has a live story must not
    // appear twice — one tile that opens their story (story takes priority
    // as the click target) but still shows the active dot if they're online.
    const ringByAuthorId = new Map<string, StoryRing>();
    for (const r of friendsRings) {
      if (r.authorPublicId) ringByAuthorId.set(String(r.authorPublicId), r);
      if (r.authorId) ringByAuthorId.set(String(r.authorId), r);
    }
    const onlineByAuthorId = new Map<string, boolean>();
    for (const c of activePeers) {
      if (c.peerUserId) onlineByAuthorId.set(String(c.peerUserId), c.isOnline === true);
    }

    for (const c of activePeers) {
      const pid = c.peerUserId ? String(c.peerUserId) : '';
      if (pid && ringByAuthorId.has(pid)) continue; // merged into the story tile below
      const firstName = c.name
      items.push({
        id: `active_${c.id}`,
        name: firstName || c.name,
        avatarUrl: c.avatarUrl ?? null,
        active: c.isOnline === true,
        onPress: () => navigateInbox(c),
      });
    }
    for (const r of friendsRings) {
      const authorId = String(r.authorPublicId ?? r.authorId ?? '');
      items.push({
        id: `ring_${r.id}`,
        name: r.name,
        avatarUrl: r.avatarUri ?? null,
        active: authorId ? onlineByAuthorId.get(authorId) === true : false,
        hasStory: true,
        storySeen: r.slides.every(s => s.isViewed),
        onPress: () => openStoryViewerFor(r.id),
      });
    }
    return items;
  }, [myStoryTile, openCreateStory, myRing, activePeers, navigateInbox, friendsRings, openStoryViewerFor]);

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
      // `white` resolves to #0A0A0A in dark mode (a near-black surface tone,
      // not true black) — the page itself should be pure black there, same
      // as the bottom nav, so use the actual background token.
      backgroundColor: colorss.background,
    },
    container: {
      flex: 1,
      backgroundColor: colorss.background,
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
    bookingCount: {
      color: colorss.primary,
      fontWeight: '700' as const,
    },
    bookingViewBtn: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: colorss.primary,
    },
    bookingViewBtnText: {
      fontSize: 12.5,
      fontWeight: '700' as const,
      color: '#FFFFFF',
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
      paddingTop: 2,
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
      paddingVertical: 4,
      paddingRight: 8,
      gap: 12,
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

  const ListHeader = useCallback(
    () => (
      <>
        {showStoryStrips ? (
          <View style={styles.storySection}>
            <View style={styles.storyStripRow}>
              <FlatList
                data={combinedStripItems}
                renderItem={({ item }) => (
                  <StoryItem
                    item={item}
                    onPress={item.onPress}
                    onBadgePress={item.onBadgePress}
                  />
                )}
                keyExtractor={item => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.storyStripFlex}
                contentContainerStyle={styles.storiesListInner}
              />
            </View>
          </View>
        ) : null}

        {/* ── Filter tabs ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {TABS.filter(
            tab =>
              // A page has no friends of its own — the list would be the
              // operator's personal friends, which is not what page mode means.
              !(activePage && tab.key === 'friends') &&
              // Pages have no message-request queue: anything sent to or from a
              // page goes straight to the inbox, so this tab is always empty in
              // page mode and only invites people to look for messages that are
              // not there.
              !(activePage && tab.key === 'requests'),
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
                {'You have '}
                {/* The count carries the brand colour so the row reads as
                    something needing attention, like an unread badge. */}
                <Text style={styles.bookingCount}>{activeBookingCount}</Text>
                {activeBookingCount === 1
                  ? ' active booking'
                  : ' active bookings'}
              </Text>
            </View>

            <View style={styles.bookingViewBtn}>
              <Text style={styles.bookingViewBtnText}>View</Text>
            </View>
          </TouchableOpacity>
        ) : null}

      </>
    ),
    [
      activeBookingCount,
      activePage,
      combinedStripItems,
      activeFilter,
      navigation,
      pendingRequestCount,
      unreadChatCount,
      showStoryStrips,
      styles,
    ],
  );


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
