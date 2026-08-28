import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
  ListRenderItem,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { Plus } from 'lucide-react-native';
import FastImage from '@d11/react-native-fast-image';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useChats } from '../context/ChatsContext';
import { setStoryFeedRings, type StoryRing } from '../data/storyFeedCache';
import { storyRingsFromConversations } from '../services/story/buildStoryRings';
import { fetchStoryFeed } from '../services/story/storyApi';
import type { RootStackNavigatorParamList } from '../types/navigators';
import { useAppSelector } from '../hooks/redux';
import {
  selectActivePage,
  selectAuthToken,
  selectHopenityProfile,
} from '../redux/features/auth/authSlice';
import {
  readStoryFeedCache,
  writeStoryFeedCache,
} from '../services/offlineCache';
import { useT } from '../hooks/useT';
import { AppColors, useAppTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');
const GAP = 12;
const COLS = 2;
const PAD = 16;
const TILE = (width - PAD * 2 - GAP * (COLS - 1)) / COLS;
const TILE_H = TILE * 1.45;

/**
 * Grid cover for a ring: the first slide that can actually be drawn as an
 * image. Video slides expose the poster via `thumbUri`.
 */
function coverUriFor(ring: StoryRing): string {
  for (const slide of ring.slides) {
    if (slide.type === 'video') {
      if (slide.thumbUri) return slide.thumbUri;
      continue;
    }
    if (slide.uri) return slide.uri;
  }
  // Nothing renderable — fall back to the first video poster-less slide's uri
  // so at least FastImage can try (some CDNs serve a frame for mp4 URLs).
  return ring.slides[0]?.thumbUri ?? '';
}

type Tile = {
  id: string;
  name: string;
  avatar?: string | null;
  cover: string;
  isAdd?: boolean;
  isMine?: boolean;
  ringIndex: number;
};

const StoriesScreen = () => {
  const t = useT();
  const { colors } = useAppTheme();
  const styles = stylesFunc(colors);
  const navigation = useNavigation();
  const { conversations } = useChats();
  const token = useAppSelector(selectAuthToken);
  const profile = useAppSelector(selectHopenityProfile);
  const activePage = useAppSelector(selectActivePage);
  const myAvatar = activePage?.image ?? profile?.avatarUrl ?? null;
  const userId = useAppSelector(selectHopenityProfile)?.userId ?? 'me';
  const stackNav = navigation.getParent() as
    | NativeStackNavigationProp<RootStackNavigatorParamList>
    | undefined;

  const [apiRings, setApiRings] = useState<StoryRing[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const cacheLoaded = useRef(false);

  // Restore persisted rings before the network request completes
  useEffect(() => {
    if (cacheLoaded.current || userId === 'me') return;
    cacheLoaded.current = true;
    const cached = readStoryFeedCache(userId);
    if (cached && cached.length > 0) setApiRings(cached);
  }, [userId]);

  const loadStories = useCallback(async () => {
    setRefreshing(true);
    try {
      const fetched = await fetchStoryFeed(token);
      if (fetched.length > 0) {
        setApiRings(fetched);
        writeStoryFeedCache(userId, fetched);
      }
    } catch {
      /* keep existing */
    } finally {
      setRefreshing(false);
    }
  }, [token, userId]);

  useEffect(() => {
    loadStories();
  }, [loadStories]);

  // Re-fetch when the screen gains focus so a freshly created story appears
  // immediately after the user navigates back from CreateStory.
  useFocusEffect(
    useCallback(() => {
      loadStories().catch(() => {});
    }, [loadStories]),
  );

  // A ring is "mine" when it was authored by whichever identity is active:
  // the selected page in page mode, otherwise the personal account.
  const isMyRing = useCallback(
    (r: StoryRing) => {
      if (activePage) {
        if (!r.isPage) return false;
        return r.authorId === activePage.id || r.authorPublicId === activePage.id;
      }
      if (r.isPage) return false;
      return r.authorId === userId || r.authorPublicId === userId;
    },
    [activePage, userId],
  );

  const { rings, tiles } = useMemo(() => {
    // Prefer real API rings; fall back to conversation-derived placeholder rings
    const convRings = storyRingsFromConversations(conversations);
    const source: StoryRing[] = apiRings.length > 0 ? apiRings : convRings;
    // Own story first so a freshly posted one is never buried mid-grid.
    const ringsList = [
      ...source.filter(isMyRing),
      ...source.filter(r => !isMyRing(r)),
    ];
    const list: Tile[] = [];
    list.push({
      id: '__add',
      name: t.add_story,
      cover: '',
      isAdd: true,
      ringIndex: 0,
    });
    ringsList.forEach((r, idx) => {
      list.push({
        id: r.id,
        name: isMyRing(r) ? 'Your story' : r.name,
        avatar: r.avatarUri,
        cover: coverUriFor(r),
        isMine: isMyRing(r),
        ringIndex: idx,
      });
    });
    return { rings: ringsList, tiles: list };
  }, [conversations, apiRings, t.add_story, isMyRing]);

  const onTile = useCallback(
    (tile: Tile) => {
      if (tile.isAdd) {
        stackNav?.navigate('CreateStory');
        return;
      }
      if (rings.length === 0 || !stackNav) return;
      setStoryFeedRings(rings);
      stackNav.navigate('StoryViewer', {
        ringIndex: Math.min(tile.ringIndex, rings.length - 1),
      });
    },
    [rings, stackNav],
  );

  const renderTile: ListRenderItem<Tile> = ({ item }) => {
    if (item.isAdd) {
      return (
        <TouchableOpacity
          style={styles.tile}
          onPress={() => onTile(item)}
          activeOpacity={0.9}
          accessibilityLabel="Create story with Hopenity"
        >
          {myAvatar ? (
            <FastImage
              source={{ uri: myAvatar }}
              style={styles.cover}
              resizeMode={FastImage.resizeMode.cover}
            />
          ) : (
            <LinearGradient
              colors={['#A855F7', '#7C3AED', '#5B21B6']}
              start={{ x: 0.1, y: 0 }}
              end={{ x: 0.9, y: 1 }}
              style={styles.cover}
            />
          )}

          <LinearGradient
            colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0.85)']}
            locations={[0, 0.45, 1]}
            style={styles.cover}
            pointerEvents="none"
          />

          <View style={styles.addCenter} pointerEvents="none">
            <View style={styles.plusCircle}>
              <Plus size={26} color="#fff" strokeWidth={3} />
            </View>
          </View>

          <View style={styles.footer} pointerEvents="none">
            <Text style={styles.caption} numberOfLines={1}>
              {item.name}
            </Text>
          </View>
        </TouchableOpacity>
      );
    }

    const initial = (item.name || '?').trim().charAt(0).toUpperCase();

    return (
      <TouchableOpacity
        style={styles.tile}
        onPress={() => onTile(item)}
        activeOpacity={0.9}
        accessibilityLabel={`Story ${item.name}`}
      >
        {item.cover ? (
          <FastImage
            source={{ uri: item.cover }}
            style={styles.cover}
            resizeMode={FastImage.resizeMode.cover}
          />
        ) : (
          <View style={[styles.cover, styles.coverFall]}>
            <Text style={styles.coverChr}>{initial}</Text>
          </View>
        )}

        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0.82)']}
          locations={[0, 0.45, 1]}
          style={styles.scrim}
          pointerEvents="none"
        />

        <View style={styles.footer}>
          <View style={styles.avatarRing}>
            {item.avatar ? (
              <FastImage
                source={{ uri: item.avatar }}
                style={styles.avatarImg}
              />
            ) : (
              <View style={[styles.avatarImg, styles.avatarFall]}>
                <Text style={styles.avatarChr}>{initial}</Text>
              </View>
            )}
          </View>
          <Text style={styles.caption} numberOfLines={1}>
            {item.name}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.head}>
        <Text style={styles.title}>{t.stories_title}</Text>
        <Text style={styles.sub}>{t.stories_sub}</Text>
      </View>
      <FlatList
        data={tiles}
        keyExtractor={i => i.id}
        renderItem={renderTile}
        numColumns={COLS}
        columnWrapperStyle={styles.column}
        contentContainerStyle={{ padding: PAD, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={loadStories}
            tintColor={colors.primary}
          />
        }
      />
    </SafeAreaView>
  );
};

export default StoriesScreen;

const stylesFunc = (colorss: AppColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colorss.background },
    head: {
      paddingHorizontal: PAD,
      paddingTop: 4,
      paddingBottom: 10,
    },
    title: {
      fontSize: 28,
      fontWeight: '800',
      color: colorss.textPrimary,
      letterSpacing: -0.5,
    },
    sub: {
      marginTop: 2,
      color: colorss.textSecondary,
      fontSize: 13,
    },
    column: {
      gap: GAP,
      marginBottom: GAP,
    },
    tile: {
      width: TILE,
      height: TILE_H,
      borderRadius: 18,
      overflow: 'hidden',
      backgroundColor: colorss.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colorss.border,
      elevation: 2,
      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
    },
    addCenter: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
    },
    plusCircle: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.18)',
      borderWidth: 1.5,
      borderColor: 'rgba(255,255,255,0.45)',
    },
    cover: {
      ...StyleSheet.absoluteFillObject,
    },
    coverFall: {
      backgroundColor: colorss.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    coverChr: {
      color: '#fff',
      fontSize: 48,
      fontWeight: '800',
      opacity: 0.85,
    },
    scrim: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: '58%',
    },
    footer: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 10,
      paddingBottom: 10,
      gap: 6,
    },
    avatarRing: {
      alignSelf: 'flex-start',
      borderRadius: 22,
      borderWidth: 2,
      borderColor: '#fff',
      padding: 1.5,
    },
    avatarImg: {
      width: 32,
      height: 32,
      borderRadius: 16,
    },
    avatarFall: {
      backgroundColor: colorss.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarChr: {
      fontWeight: '800',
      color: '#fff',
      fontSize: 13,
    },
    caption: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 13,
      textShadowColor: 'rgba(0,0,0,0.6)',
      textShadowRadius: 4,
      textShadowOffset: { width: 0, height: 1 },
    },
  });
