import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useColors } from '../hooks/useColors';
import {
  Animated,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { ArrowLeft, SearchIcon, X } from 'lucide-react-native';
import { CompositeScreenProps } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import FastImage from '@d11/react-native-fast-image';

import { radius } from '../theme';
import { IC_PROFILE } from '../assets';
import type {
  BottomTabNavigatorParamList,
  RootStackNavigatorParamList,
} from '../types/navigators';
import { useAppSelector } from '../hooks/redux';
import { selectHopenityProfile } from '../redux/features/auth/authSlice';
import { normalizeChatUserId } from '../utils/chatUserId';
import { resolveLiveKitRoomName } from '../utils/livekitRoomId';
import { API_BASE_URL } from '../config/env';
import { useChats } from '../context/ChatsContext';
import { useT } from '../hooks/useT';
import { getOrCreatePeerChat } from '../services/chatService';
import {
  addToSearchHistory,
  clearSearchHistory,
  getSearchHistory,
  removeFromSearchHistory,
  type SearchHistoryEntry,
} from '../services/searchHistoryService';
import { AppColors, useAppTheme } from '../context/ThemeContext';

type Props = CompositeScreenProps<
  NativeStackScreenProps<RootStackNavigatorParamList, 'Search'>,
  BottomTabScreenProps<BottomTabNavigatorParamList, 'Home'>
>;

type UserResult = {
  user_id: string;
  name: string;
  username?: string;
  image?: string | null;
  isVerified?: boolean;
  followers_count?: number;
  isOnline?: boolean;
};

const TABS = ['All', 'People', 'Messages', 'Groups'] as const;
type Tab = (typeof TABS)[number];

// --- Skeleton ----------------------------------------------------------------

function SkeletonBox({
  width,
  height,
  borderRadius = 6,
  style,
}: {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: object;
}) {
  const opacity = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);
  const { colors } = useAppTheme();
  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: colors.backgroundDeep,
        },
        { opacity },
        style,
      ]}
    />
  );
}

function SkeletonRow() {
  return (
    <View style={skStyles.row}>
      <SkeletonBox width={48} height={48} borderRadius={24} />
      <View style={{ flex: 1, gap: 8 }}>
        <SkeletonBox width="55%" height={14} />
        <SkeletonBox width="35%" height={11} />
      </View>
    </View>
  );
}

function SkeletonGridItem() {
  return (
    <View style={skStyles.gridItem}>
      <SkeletonBox width={52} height={52} borderRadius={26} />
      <SkeletonBox width={44} height={11} style={{ marginTop: 6 }} />
    </View>
  );
}

// --- API helpers -------------------------------------------------------------

async function fetchUsers(
  searchTerm: string,
  token: string | null,
  limit = 20,
): Promise<UserResult[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (searchTerm) params.set('searchTerm', searchTerm.trim());
  const res = await fetch(
    `${API_BASE_URL}/api/v1/search/users?${params.toString()}`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  );
  const json = await res.json();
  const results =
    json?.responseObject?.results ??
    json?.data?.users?.results ??
    json?.results ??
    [];
  return Array.isArray(results) ? results : [];
}

// --- Screen -------------------------------------------------------------------

const SearchScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useAppTheme();
  const styles = stylesFunc(colors);
  const t = useT();
  const token = useAppSelector(s => s.auth.token);
  const profile = useAppSelector(selectHopenityProfile);
  const giftedChatUser = useAppSelector(s => s.auth.giftedChatUser);
  const { conversations } = useChats();
  const localUserId =
    normalizeChatUserId(giftedChatUser?._id) ||
    normalizeChatUserId(profile?.userId) ||
    '';

  const { bottom } = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('All');
  const [history, setHistory] = useState<SearchHistoryEntry[]>(() =>
    getSearchHistory(),
  );

  const [results, setResults] = useState<UserResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Friends from accepted chats (the only people the user may want to message)
  const friends = useMemo<UserResult[]>(
    () =>
      conversations
        .filter(c => !c.isGroup && !c.needsAcceptance && c.peerUserId)
        .map(c => ({
          user_id: c.peerUserId!,
          name: c.name,
          username: undefined,
          image: c.avatarUrl ?? null,
          isVerified: false,
          isOnline: c.isOnline,
        })),
    [conversations],
  );

  // Debounced search on query change
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchLoading(true);
      fetchUsers(query.trim(), token, 30)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setSearchLoading(false));
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, token]);

  const openChat = useCallback(
    async (user: UserResult | SearchHistoryEntry) => {
      const peerId = String(
        (user as SearchHistoryEntry).userId ?? (user as UserResult).user_id,
      );

      // Persist to history
      addToSearchHistory({
        userId: peerId,
        name: user.name,
        username: (user as UserResult).username ?? null,
        image: user.image ?? null,
      });
      setHistory(getSearchHistory());

      const existing = conversations.find(
        c =>
          !c.isGroup &&
          c.peerUserId != null &&
          normalizeChatUserId(c.peerUserId) === normalizeChatUserId(peerId),
      );

      let conversationId: string;
      if (existing) {
        conversationId = String(existing.id);
      } else {
        const realId = token ? await getOrCreatePeerChat(peerId, token) : null;
        conversationId = realId ?? peerId;
      }

      const liveKitRoom = resolveLiveKitRoomName({
        conversationId,
        peerUserId: peerId,
        localUserId,
      });

      navigation.navigate('Inbox', {
        conversationId,
        displayName: user.name,
        avatarUrl: user.image ?? null,
        liveKitRoom,
        seedConversation: existing ?? {
          id: conversationId,
          name: user.name,
          avatarUrl: user.image ?? null,
          peerUserId: peerId,
          isGroup: false,
          needsAcceptance: false,
          preview: '',
          time: '',
          unreadCount: 0,
          messages: [],
        },
      });
    },
    [navigation, localUserId, conversations, token],
  );

  const handleRemoveHistory = useCallback((userId: string) => {
    removeFromSearchHistory(userId);
    setHistory(getSearchHistory());
  }, []);

  const handleClearHistory = useCallback(() => {
    clearSearchHistory();
    setHistory([]);
  }, []);

  const renderUser = useCallback(
    ({ item }: { item: UserResult }) => (
      <TouchableOpacity
        style={styles.userRow}
        activeOpacity={0.75}
        onPress={() => openChat(item)}
      >
        <View style={styles.avatarWrap}>
          <FastImage
            source={item.image ? { uri: item.image } : IC_PROFILE}
            style={styles.avatar}
          />
          {item.isOnline && <View style={styles.onlineDot} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.userName} numberOfLines={1}>
            {item.name}
            {item.isVerified ? '  ✓' : ''}
          </Text>
          {item.username ? (
            <Text style={styles.userSub} numberOfLines={1}>
              @{item.username}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
    ),
    [openChat],
  );

  // -- Search results view --
  if (query.trim()) {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
        <Header
          query={query}
          onChangeQuery={setQuery}
          onBack={() => navigation.goBack()}
        />

        <View style={styles.tabRow}>
          {TABS.map(tab => {
            const tabLabel =
              tab === 'All'
                ? t.tab_all
                : tab === 'People'
                ? t.tab_people
                : tab === 'Messages'
                ? t.tab_messages_label
                : t.tab_groups;
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={[styles.tab, activeTab === tab && styles.tabActive]}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === tab && styles.tabTextActive,
                  ]}
                >
                  {tabLabel}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {searchLoading ? (
          <View style={styles.listPad}>
            {[...Array(8)].map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </View>
        ) : results.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {t.no_results} "{query}"
            </Text>
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={u => u.user_id}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.listPad,
              { paddingBottom: bottom + 20 },
            ]}
            renderItem={renderUser}
          />
        )}
      </SafeAreaView>
    );
  }

  // -- Default / home view --
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <Header
        query={query}
        onChangeQuery={setQuery}
        onBack={() => navigation.goBack()}
      />

      <FlatList
        data={[]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.listPad, { paddingBottom: bottom + 20 }]}
        ListEmptyComponent={null}
        ListHeaderComponent={
          <>
            {/* -- Recent Searches -- */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{t.recent_searches}</Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate('EditSearchHistory')}
                >
                  <Text style={styles.editText}>{t.edit}</Text>
                </TouchableOpacity>
              </View>

              {history.length === 0 ? (
                <Text style={styles.emptySection}>No recent searches.</Text>
              ) : (
                <View style={styles.recentGrid}>
                  {history.slice(0, 10).map(entry => (
                    <View key={entry.userId} style={styles.recentItemWrap}>
                      <TouchableOpacity
                        style={styles.recentItem}
                        onPress={() => openChat(entry)}
                      >
                        <View style={styles.avatarWrap}>
                          <FastImage
                            source={
                              entry.image ? { uri: entry.image } : IC_PROFILE
                            }
                            style={styles.recentAvatar}
                          />
                        </View>
                        <Text style={styles.recentName} numberOfLines={1}>
                          {entry.name.split(' ')[0]}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.removeBtn}
                        onPress={() => handleRemoveHistory(entry.userId)}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <X size={11} color={colors.textSecondary} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {history.length > 0 && (
                <TouchableOpacity
                  onPress={handleClearHistory}
                  style={styles.clearBtn}
                >
                  <Text style={styles.clearText}>Clear all</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* -- Suggested (friends / accepted chats) -- */}
            <Text style={styles.sectionTitle}>{t.suggested}</Text>
            <Text style={styles.sectionSub}>People you chat with</Text>

            {friends.length === 0 ? (
              <Text style={styles.emptySection}>
                Start a conversation to see suggestions.
              </Text>
            ) : (
              friends.map(user => (
                <TouchableOpacity
                  key={user.user_id}
                  style={styles.userRow}
                  activeOpacity={0.75}
                  onPress={() => openChat(user)}
                >
                  <View style={styles.avatarWrap}>
                    <FastImage
                      source={user.image ? { uri: user.image } : IC_PROFILE}
                      style={styles.avatar}
                    />
                    {user.isOnline && <View style={styles.onlineDot} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.userName} numberOfLines={1}>
                      {user.name}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </>
        }
        renderItem={() => null}
      />
    </SafeAreaView>
  );
};

// --- Header sub-component -----------------------------------------------------

function Header({
  query,
  onChangeQuery,
  onBack,
}: {
  query: string;
  onChangeQuery: (v: string) => void;
  onBack: () => void;
}) {
  const t = useT();
  const { colors } = useAppTheme();
  const styles = stylesFunc(colors);
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <ArrowLeft color={colors.textPrimary} />
      </TouchableOpacity>
      <View style={styles.searchBox}>
        <SearchIcon size={18} color={colors.textSecondary} />
        <TextInput
          style={styles.input}
          placeholder={t.search_placeholder}
          placeholderTextColor={colors.textSecondary}
          value={query}
          onChangeText={onChangeQuery}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {query.length > 0 && (
          <TouchableOpacity
            onPress={() => onChangeQuery('')}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <X size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export default SearchScreen;

// --- Styles -------------------------------------------------------------------

const stylesFunc = (colorss: AppColors) => {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colorss.surface, paddingTop: 10 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: colorss.placeholder,
      paddingHorizontal: 10,
      paddingBottom: 6,
      gap: 8,
    },
    backBtn: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colorss.background,
      flex: 1,
      borderRadius: radius.md,
      paddingHorizontal: 12,
      paddingVertical: 8,
      gap: 8,
    },
    input: { flex: 1, fontSize: 14, color: colorss.textSecondary, padding: 0 },
    tabRow: {
      flexDirection: 'row',
      paddingHorizontal: 10,
      paddingTop: 12,
      paddingBottom: 4,
      gap: 6,
    },
    tab: { borderRadius: 16, paddingVertical: 5, paddingHorizontal: 14 },
    tabActive: { backgroundColor: colorss.background },
    tabText: { fontSize: 14, color: colorss.textSecondary },
    tabTextActive: { color: colorss.textPrimary, fontWeight: '600' },
    listPad: { paddingHorizontal: 14, paddingTop: 10 },
    section: { marginVertical: 16 },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 14,
      color: colorss.textSecondary,
      fontWeight: '600',
    },
    sectionSub: {
      fontSize: 12,
      color: colorss.placeholder,
      marginTop: 2,
      marginBottom: 8,
    },
    editText: { fontSize: 13, color: colorss.accent, fontWeight: '600' },
    emptySection: {
      fontSize: 13,
      color: colorss.placeholder,
      marginBottom: 12,
    },
    recentGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    recentItemWrap: { width: '17%', alignItems: 'center' },
    recentItem: { alignItems: 'center' },
    recentAvatar: { width: 52, height: 52, borderRadius: 26 },
    recentName: {
      fontSize: 12,
      color: colorss.textPrimary,
      marginTop: 4,
      textAlign: 'center',
    },
    removeBtn: {
      position: 'absolute',
      top: -4,
      right: -4,
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: colorss.backgroundDeep,
      justifyContent: 'center',
      alignItems: 'center',
    },
    clearBtn: { alignSelf: 'flex-end', marginTop: 8, padding: 4 },
    clearText: { fontSize: 13, color: colorss.accent },
    avatarWrap: { position: 'relative' },
    avatar: { width: 48, height: 48, borderRadius: 24 },
    onlineDot: {
      position: 'absolute',
      bottom: 1,
      right: 1,
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: colorss.success,
      borderWidth: 2,
      borderColor: colorss.surface,
    },
    userRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 8,
    },
    userName: { fontSize: 15, fontWeight: '600', color: colorss.textPrimary },
    userSub: { fontSize: 13, color: colorss.textSecondary, marginTop: 2 },
    empty: { flex: 1, alignItems: 'center', paddingTop: 60 },
    emptyText: { color: colorss.textSecondary, fontSize: 15 },
  });
};

const skStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  gridItem: { width: '17%', alignItems: 'center' },
});
