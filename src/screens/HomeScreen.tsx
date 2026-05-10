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
import {
  BottomTabNavigatorParamList,
  RootStackNavigatorParamList,
} from '../types/navigators';
import { CompositeScreenProps } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BellOff } from 'lucide-react-native';

type Props = CompositeScreenProps<
  BottomTabScreenProps<BottomTabNavigatorParamList, 'Home'>,
  NativeStackScreenProps<RootStackNavigatorParamList, 'Search'>
>;

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
          onPress={() =>
            navigation.navigate('Inbox', {
              conversationId: item.id,
            })
          }
          onLongPress={() => navigation.navigate('ConversationAction')}
        />
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
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingBottom: 8,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={styles.sectionLabel}>Messages</Text>
            <BellOff size={18} color={colorss.textPrimary} />
          </View>
          <Text style={[styles.sectionLabel, { color: colorss.primary }]}>
            Requests
          </Text>
        </View>
      </>
    ),
    [renderStory],
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <Header
        onSearch={() => {
          /* focus search bar */
        }}
        onNewChat={() => Alert.alert('New Chat', 'Start a new conversation')}
      />
      <SearchBar onSearchPress={() => navigation.navigate('Search')} />
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
    backgroundColor: colorss.white,
  },
  container: {
    flex: 1,
    backgroundColor: colorss.white,
  },
  storiesList: {
    paddingHorizontal: spacing.xl,
    paddingVertical: 14,
    gap: 12,
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
});

export default HomeScreen;
