import React, { useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../components/home/Header';
import StoryItem from '../components/home/StoryItem';
import ConversationItem from '../components/home/ConversationItem';
import SearchBar from '../components/home/SearchBar';
import { stories, conversations } from '../data/mockData';
import { colors, spacing, fonts, colorss } from '../theme';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { BottomTabNavigatorParamList } from '../types/navigators';

type Props = BottomTabScreenProps<BottomTabNavigatorParamList, 'Home'>;

const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const handleStoryPress = useCallback((item: { isAdd: any; name: any }) => {
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
          onPress={() => navigation.navigate('Inbox')}
        />
        {index < conversations.length - 1 && <View style={styles.divider} />}
      </>
    ),
    [navigation],
  );

  const ListHeader = useCallback(
    () => (
      <>
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
    [renderStory],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        onSearch={() => {
          /* focus search bar */
        }}
        onNewChat={() => Alert.alert('New Chat', 'Start a new conversation')}
      />
      <SearchBar />
      <View style={styles.container}>
        <FlatList
          data={conversations}
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
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colorss.primary,
  },
  container: {
    flex: 1,
    backgroundColor: colorss.background,
  },
  storiesList: {
    paddingHorizontal: spacing.xl,
    paddingVertical: 14,
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
