import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Alert,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../components/home/Header';
import StoryItem from '../components/home/StoryItem';
import ConversationItem from '../components/home/ConversationItem';
import SearchBar from '../components/home/SearchBar';
import { colors, spacing, fonts, colorss } from '../theme';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import {
  BottomTabNavigatorParamList,
  RootStackNavigatorParamList,
} from '../types/navigators';
import { CompositeScreenProps } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BellOff, PlayCircle } from 'lucide-react-native';
import { useChats } from '../context/ChatsContext';
import type { ConversationSummary } from '../context/ChatsContext';
import { useFocusEffect } from '@react-navigation/native';
import { setStoryFeedRings } from '../data/storyFeedCache';
import { storyRingsFromConversations } from '../services/story/buildStoryRings';
import { openHopenityBestEffort } from '../services/hopenityLinking';
import { useAppSelector } from '../hooks/redux';
import {
  selectHopenityProfile,
} from '../redux/features/auth/authSlice';
import { normalizeChatUserId } from '../utils/chatUserId';
import { resolveLiveKitRoomName } from '../utils/livekitRoomId';

type Props = CompositeScreenProps<
  BottomTabScreenProps<BottomTabNavigatorParamList, 'Home'>,
  NativeStackScreenProps<RootStackNavigatorParamList, 'Search'>
>;

const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const giftedChatUser = useAppSelector(s => s.auth.giftedChatUser);
  const profile = useAppSelector(selectHopenityProfile);
  const localUserId = useMemo(
    () =>
      normalizeChatUserId(giftedChatUser?._id) ||
      normalizeChatUserId(profile?.userId) ||
      '',
    [giftedChatUser, profile],
  );

  const { conversations, reloadConversations, listLoading, pendingRequestCount } =
    useChats();

  useFocusEffect(
    useCallback(() => {
      reloadConversations().catch(() => undefined);
      return undefined;
    }, [reloadConversations]),
  );

  const directChats = useMemo(
    () => conversations.filter(c => !c.isGroup),
    [conversations],
  );

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
        .filter(c => c.isOnline === true)
        .sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
        ),
    [directChats],
  );

  const friendsStrip = useMemo(
    () => [...directChats].sort(onlineFirst),
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

  const openStoryViewer = useCallback(() => {
    const rings = storyRingsFromConversations(conversations);
    if (rings.length === 0) {
      Alert.alert('Stories', 'No stories yet for your chats.');
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

  const renderStoryViewerTile = useCallback(
    () => (
      <TouchableOpacity
        style={styles.storyViewerTile}
        onPress={openStoryViewer}
        accessibilityRole="button"
        accessibilityLabel="Open stories viewer"
      >
        <PlayCircle size={28} color={colorss.primary} />
        <Text style={styles.storyViewerLabel}>Stories</Text>
      </TouchableOpacity>
    ),
    [openStoryViewer],
  );

  const renderConversation = useCallback(
    ({ item }: { item: ConversationSummary }) => (
      <ConversationItem
        item={item}
        onPress={() => navigateInbox(item)}
        onLongPress={() => navigation.navigate('ConversationAction')}
      />
    ),
    [navigation, navigateInbox],
  );

  const showStoryStrips = activePeers.length > 0 || friendsStrip.length > 0;

  const ListHeader = useCallback(
    () => (
      <>
        {showStoryStrips ? (
          <>
            {activePeers.length > 0 ? (
              <View style={styles.storySection}>
                <Text style={styles.stripSectionLabel}>Active</Text>
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
            ) : null}

            {friendsStrip.length > 0 ? (
              <View style={styles.storySection}>
                <Text style={styles.stripSectionLabel}>
                  {activePeers.length > 0 ? 'Friends' : 'Friends & chats'}
                </Text>
                <View style={styles.storyStripRow}>
                  <FlatList
                    data={friendsStrip}
                    renderItem={({ item }) => (
                      <StoryItem
                        item={toStoryShape(item)}
                        onPress={() => navigateInbox(item)}
                      />
                    )}
                    keyExtractor={item => `friend_${item.id}`}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.storyStripFlex}
                    contentContainerStyle={styles.storiesListInner}
                  />
                  {activePeers.length === 0 ? renderStoryViewerTile() : null}
                </View>
              </View>
            ) : null}
          </>
        ) : null}

        <View style={styles.messagesHeaderRow}>
          <View style={styles.messagesHeaderLeft}>
            <Text style={styles.sectionLabel}>Messages</Text>
            <BellOff size={18} color={colorss.textPrimary} />
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Message requests"
            onPress={() => navigation.navigate('MessageRequests')}
            style={styles.requestsPillRow}
          >
            <Text style={[styles.sectionLabel, styles.requestsLabel]}>
              Requests
            </Text>
            {pendingRequestCount > 0 ? (
              <View style={styles.requestBadge}>
                <Text style={styles.requestBadgeText}>
                  {pendingRequestCount > 99 ? '99+' : pendingRequestCount}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>
      </>
    ),
    [
      activePeers,
      friendsStrip,
      navigateInbox,
      navigation,
      pendingRequestCount,
      renderStoryViewerTile,
      showStoryStrips,
      toStoryShape,
    ],
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <Header
        onSearch={() => {
          /* focus search bar */
        }}
        onNewChat={() =>
          openHopenityBestEffort().catch(() => undefined)
        }
      />
      <SearchBar onSearchPress={() => navigation.navigate('Search')} />
      <View style={styles.container}>
        <FlatList
          data={conversations}
          renderItem={renderConversation}
          keyExtractor={item => item.id}
          extraData={conversations}
          ListHeaderComponent={ListHeader}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={listLoading}
              onRefresh={reloadConversations}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No conversations found</Text>
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colorss.white,
  },
  container: {
    flex: 1,
    backgroundColor: colorss.white,
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
    fontWeight: '700',
  },
});

export default HomeScreen;
