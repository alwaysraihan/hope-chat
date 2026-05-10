import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
  ListRenderItem,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import FastImage from '@d11/react-native-fast-image';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colorss } from '../theme';
import { useChats } from '../context/ChatsContext';
import { setStoryFeedRings } from '../data/storyFeedCache';
import {
  storyRingsFromConversations,
} from '../services/story/buildStoryRings';
import { openHopenityBestEffort } from '../services/hopenityLinking';
import type { RootStackNavigatorParamList } from '../types/navigators';

const { width } = Dimensions.get('window');
const GAP = 12;
const COLS = 2;
const TILE = (width - 32 - GAP * (COLS - 1)) / COLS;
const TILE_H = TILE * 1.35;

type Tile = {
  id: string;
  name: string;
  avatar?: string | null;
  cover: string;
  isAdd?: boolean;
  ringIndex: number;
};

const StoriesScreen = () => {
  const navigation = useNavigation();
  const { conversations } = useChats();
  const stackNav =
    navigation.getParent() as
      | NativeStackNavigationProp<RootStackNavigatorParamList>
      | undefined;

  const { rings, tiles } = useMemo(() => {
    const ringsList = storyRingsFromConversations(conversations);
    const list: Tile[] = [];
    list.push({
      id: '__add',
      name: 'Add story',
      cover: '',
      isAdd: true,
      ringIndex: 0,
    });
    ringsList.forEach((r, idx) => {
      list.push({
        id: r.id,
        name: r.name,
        avatar: r.avatarUri,
        cover: r.slides[0]?.uri ?? '',
        ringIndex: idx,
      });
    });
    return { rings: ringsList, tiles: list };
  }, [conversations]);

  const onTile = useCallback(
    (t: Tile) => {
      if (t.isAdd) {
        void openHopenityBestEffort();
        return;
      }
      if (rings.length === 0 || !stackNav) return;
      setStoryFeedRings(rings);
      stackNav.navigate('StoryViewer', {
        ringIndex: Math.min(t.ringIndex, rings.length - 1),
      });
    },
    [rings, stackNav],
  );

  const renderTile: ListRenderItem<Tile> = ({ item }) => {
    if (item.isAdd) {
      return (
        <TouchableOpacity
          style={[styles.tile, styles.addOuter]}
          onPress={() => onTile(item)}
          activeOpacity={0.92}
          accessibilityLabel="Create story with Hopenity"
        >
          <LinearGradient
            colors={['#9333EA', '#6D28D9', '#4C1D95']}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.addGrad}
          >
            <Text style={styles.plus}>＋</Text>
            <Text style={styles.addLabel}>Story</Text>
          </LinearGradient>
          <LinearGradient colors={['transparent', '#000']} style={styles.shade}>
            <Text style={styles.caption}>{item.name}</Text>
          </LinearGradient>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        style={styles.tile}
        onPress={() => onTile(item)}
        activeOpacity={0.9}
        accessibilityLabel={`Story ${item.name}`}
      >
        <FastImage source={{ uri: item.cover }} style={styles.cover} />
        <LinearGradient colors={['rgba(0,0,0,0.06)', '#000']} style={styles.shade}>
          <View style={styles.avatarRing}>
            {item.avatar ? (
              <FastImage source={{ uri: item.avatar }} style={styles.avatarImg} />
            ) : (
              <View style={[styles.avatarImg, styles.avatarFall]}>
                <Text style={styles.avatarChr}>
                  {item.name.trim().charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.caption} numberOfLines={1}>
            {item.name}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.head}>
        <Text style={styles.title}>Stories</Text>
        <Text style={styles.sub}>
          From your chats — add new ones in{' '}
          <Text style={styles.bold}>Hopenity</Text>
        </Text>
      </View>
      <FlatList
        data={tiles}
        keyExtractor={i => i.id}
        renderItem={renderTile}
        numColumns={COLS}
        columnWrapperStyle={styles.column}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      />
    </SafeAreaView>
  );
};

export default StoriesScreen;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colorss.surface },
  head: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: colorss.border,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colorss.textPrimary,
  },
  sub: {
    marginTop: 4,
    color: colorss.textSecondary,
    fontSize: 13,
  },
  bold: { fontWeight: '800', color: colorss.primary },
  column: {
    justifyContent: 'space-between',
    marginBottom: GAP,
    gap: GAP,
  },
  tile: {
    width: TILE,
    height: TILE_H,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#141414',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  addOuter: { padding: 0 },
  addGrad: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plus: {
    fontSize: 44,
    color: '#fff',
    marginBottom: -4,
    fontWeight: '800',
  },
  addLabel: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.78)',
    fontWeight: '700',
  },
  cover: {
    ...StyleSheet.absoluteFillObject,
  },
  shade: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: 12,
    paddingTop: 40,
  },
  avatarRing: {
    alignSelf: 'flex-start',
    marginBottom: 8,
    borderRadius: 30,
    borderWidth: 2.5,
    borderColor: colorss.white,
    padding: 2,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  avatarImg: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarFall: {
    backgroundColor: colorss.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarChr: {
    fontWeight: '800',
    color: '#fff',
    fontSize: 14,
  },
  caption: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 1 },
  },
});
