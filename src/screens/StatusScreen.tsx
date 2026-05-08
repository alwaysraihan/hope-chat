import { Camera, LayoutGrid, Search } from 'lucide-react-native';
import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme';

const STATUS_USERS = [
  {
    id: '1',
    name: 'Fitria',
    avatar: 'https://i.pravatar.cc/60?img=31',
    hasStory: true,
  },
  {
    id: '2',
    name: 'Fazaaa',
    avatar: 'https://i.pravatar.cc/60?img=32',
    hasStory: true,
  },
  { id: '3', name: 'Nola Sfyn', avatar: null, hasStory: false },
  {
    id: '4',
    name: 'Farhan Baqs',
    avatar: 'https://i.pravatar.cc/60?img=34',
    hasStory: true,
  },
  {
    id: '5',
    name: 'Jopran',
    avatar: 'https://i.pravatar.cc/60?img=35',
    hasStory: true,
  },
];
const STATUS_POSTS = [
  {
    id: '1',
    user: '@Momon',
    image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400',
    hasVideo: true,
  },
  {
    id: '2',
    user: '@Adhitya Putra',
    image: 'https://images.unsplash.com/photo-1593642634367-d91a135587b5?w=400',
    hasVideo: true,
  },
  {
    id: '3',
    user: '@Azhaara',
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400',
    hasVideo: true,
  },
  {
    id: '4',
    user: null,
    image: 'https://images.unsplash.com/photo-1556742044-3c52d6e88c62?w=400',
    hasVideo: true,
  },
];

const Avatar = ({ uri, size = 44, name = '', online = false }) => {
  const colors = ['#5468F3', '#7C3AED', '#059669', '#DC2626', '#D97706'];
  const bg = colors[(name.charCodeAt(0) || 0) % colors.length];

  return (
    <View style={[styles.avatarWrapper, { width: size, height: size }]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={[styles.avatarImage, { width: size, height: size }]}
        />
      ) : (
        <View style={[styles.avatarFallback, { backgroundColor: bg }]}>
          <Text
            style={{
              color: theme.white,
              fontWeight: '700',
              fontSize: size * 0.38,
            }}
          >
            {name.charAt(0).toUpperCase()}
          </Text>
        </View>
      )}

      {online && <View style={styles.onlineDot} />}
    </View>
  );
};

// ─── Screen ────────────────────────────────
const StatusScreen = () => {
  return (
    <SafeAreaView style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.iconBtn}>
          <LayoutGrid size={18} color={theme.textPrimary} />
        </View>

        <Text style={styles.headerTitle}>Status</Text>

        <View style={styles.iconBtn}>
          <Camera size={18} color={theme.textPrimary} />
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <Search size={18} color={theme.textMuted} />
        <TextInput
          placeholder="Search..."
          placeholderTextColor={theme.placeholder}
          style={styles.searchInput}
        />
      </View>

      {/* Posts */}
      <FlatList
        data={STATUS_POSTS}
        numColumns={2}
        ListHeaderComponent={
          <FlatList
            data={STATUS_USERS}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={i => i.id}
            contentContainerStyle={styles.storyList}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.storyItem}>
                <View
                  style={[
                    styles.storyRing,
                    !item.hasStory && styles.storyInactive,
                  ]}
                >
                  <Avatar uri={item.avatar} name={item.name} size={52} />
                </View>
                <Text style={styles.storyName}>{item.name}</Text>
              </TouchableOpacity>
            )}
          />
        }
        keyExtractor={i => i.id}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.postCard}>
            <Image source={{ uri: item.image }} style={styles.postImage} />

            {item.hasVideo && (
              <View style={styles.playBadge}>
                <Text style={styles.playText}>▶</Text>
              </View>
            )}

            {item.user && (
              <View style={styles.postUser}>
                <Avatar name={item.user.replace('@', '')} size={22} />
                <Text style={styles.postUserText}>{item.user}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
};

export default StatusScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    alignItems: 'center',
  },

  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.textPrimary,
  },

  iconBtn: {
    backgroundColor: theme.surface,
    padding: 8,
    borderRadius: 999,
  },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    marginHorizontal: 16,
    borderRadius: 999,
    paddingHorizontal: 12,
    gap: 8,
  },

  searchInput: {
    flex: 1,
    color: theme.textPrimary,
    paddingVertical: 8,
  },

  // Stories
  storyList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 16,
  },

  storyItem: {
    alignItems: 'center',
  },

  storyRing: {
    padding: 2,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: theme.primary,
  },

  storyInactive: {
    borderColor: theme.border,
  },

  storyName: {
    fontSize: 11,
    color: theme.textSecondary,
    marginTop: 4,
  },

  // Posts
  grid: {
    paddingHorizontal: 10,
    // paddingTop: 8,
  },

  gridRow: {
    gap: 8,
  },

  postCard: {
    flex: 1,
    margin: 4,
    borderRadius: 12,
    overflow: 'hidden',
    height: 160,
    backgroundColor: theme.surface,
  },

  postImage: {
    width: '100%',
    height: '100%',
  },

  playBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 12,
    padding: 6,
  },

  playText: {
    color: theme.white,
  },

  postUser: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 5,
  },

  postUserText: {
    color: theme.white,
    fontSize: 11,
  },

  // Avatar
  avatarWrapper: {
    position: 'relative',
  },

  avatarImage: {
    borderRadius: 999,
  },

  avatarFallback: {
    flex: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },

  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 99,
    backgroundColor: theme.success,
    borderWidth: 2,
    borderColor: theme.white,
  },
});
