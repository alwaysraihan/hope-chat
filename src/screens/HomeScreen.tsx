import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../components/Header';
import StoryItem from '../components/StoryItem';
import ConversationItem from '../components/ConversationItem';
import SearchBar from '../components/SearchBar';
import BottomTabBar from '../components/BottomTabBar';
import { stories, conversations } from '../data/mockData';
import { colors, spacing, fonts } from '../theme';

const HomeScreen = ({}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('Chats');

  const filteredConversations = searchQuery
    ? conversations.filter(
        c =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.preview.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : conversations;

  const handleConversationPress = useCallback(item => {
    // Navigate to chat screen — wire up with navigation prop
    Alert.alert('Open Chat', `Opening chat with ${item.name}`);
    // navigation.navigate('ChatScreen', { conversation: item });
  }, []);

  const handleStoryPress = useCallback(item => {
    if (item.isAdd) {
      Alert.alert('Add Story', 'Open camera to add a story');
    } else {
      Alert.alert('View Story', `Viewing ${item.name}'s story`);
    }
  }, []);

  const renderStory = useCallback(
    ({ item }) => (
      <StoryItem item={item} onPress={() => handleStoryPress(item)} />
    ),
    [handleStoryPress],
  );

  const renderConversation = useCallback(
    ({ item, index }) => (
      <>
        <ConversationItem
          item={item}
          onPress={() => handleConversationPress(item)}
        />
        {index < filteredConversations.length - 1 && (
          <View style={styles.divider} />
        )}
      </>
    ),
    [filteredConversations.length, handleConversationPress],
  );

  const ListHeader = useCallback(
    () => (
      <>
        <Header
          onSearch={() => {
            /* focus search bar */
          }}
          onNewChat={() => Alert.alert('New Chat', 'Start a new conversation')}
        />
        <SearchBar value={searchQuery} onChangeText={setSearchQuery} />
        <FlatList
          data={stories}
          renderItem={renderStory}
          keyExtractor={item => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.storiesList}
        />
        <Text style={styles.sectionLabel}>Messages</Text>
      </>
    ),
    [renderStory, searchQuery],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <View style={styles.container}>
        <FlatList
          data={filteredConversations}
          renderItem={renderConversation}
          keyExtractor={item => item.id}
          ListHeaderComponent={ListHeader}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No conversations found</Text>
            </View>
          }
        />
        <BottomTabBar activeTab={activeTab} onTabPress={setActiveTab} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  storiesList: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 14,
    gap: 12,
  },
  sectionLabel: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 8,
    fontSize: 11,
    fontWeight: fonts.semibold,
    color: colors.textMuted,
    letterSpacing: 0.08 * 11,
    textTransform: 'uppercase',
  },
  divider: {
    height: 0.5,
    backgroundColor: '#1a1a2c',
    marginHorizontal: spacing.xl,
  },
  listContent: {
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
});

export default HomeScreen;
