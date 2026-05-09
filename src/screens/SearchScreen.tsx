import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import React, { useState } from 'react';
import { colors, colorss, radius } from '../theme';
import { SearchIcon, ArrowLeft } from 'lucide-react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { IC_PROFILE } from '../assets';
import { CompositeScreenProps } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import {
  BottomTabNavigatorParamList,
  RootStackNavigatorParamList,
} from '../types/navigators';
import { useChats } from '../context/ChatsContext';

type Props = CompositeScreenProps<
  NativeStackScreenProps<RootStackNavigatorParamList, 'Search'>,
  BottomTabScreenProps<BottomTabNavigatorParamList, 'Home'>
>;

const conversationType = [
  {
    id: 1,
    title: 'All',
    active: true,
  },
  {
    id: 2,
    title: 'People',
    active: false,
  },
  {
    id: 3,
    title: 'Messages',
    active: false,
  },
  {
    id: 4,
    title: 'Groups',
    active: false,
  },
];

const SearchScreen: React.FC<Props> = ({ navigation }) => {
  const { conversations } = useChats();
  const goInbox = () => {
    const c = conversations[0];
    navigation.navigate('Inbox', {
      conversationId: c?.id ?? '1',
      displayName: c?.name ?? 'Chat',
      avatarUrl: c?.avatarUrl,
      liveKitRoom: `call_${c?.id ?? '1'}`,
    });
  };

  const [value, onChangeText] = useState('');
  const [isOnline] = useState(true);
  const [conversationCategories, setConversationCategories] =
    useState(conversationType);
  const { bottom } = useSafeAreaInsets();

  let content = (
    <FlatList
      data={[1, 2, 3, 4, 5, 6, 7, 8, 9]}
      keyExtractor={item => item.toString()}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[
        styles.mainListContent,
        { paddingBottom: bottom },
      ]}
      ListHeaderComponent={
        <View>
          {/* RECENT SEARCHES */}
          <View style={styles.recentSearchContainer}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Recent searches</Text>
              <TouchableOpacity
                onPress={() => {
                  navigation.navigate('EditSearchHistory');
                }}
              >
                <Text style={styles.editText}>EDIT</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.recentGrid}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(item => (
                <TouchableOpacity
                  onPress={goInbox}
                  key={item}
                  style={styles.recentItem}
                >
                  <View style={styles.avatarWrap}>
                    <Image source={IC_PROFILE} style={styles.avatar} />
                    {isOnline && <View style={styles.onlineDot} />}
                  </View>
                  <Text style={styles.recentName}>Raihan</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* RECENT FEELS */}
          <View style={styles.feelsContainer}>
            <Text style={styles.sectionTitle}>Recent feels</Text>

            <FlatList
              data={[1, 2, 3, 4, 5, 6, 7, 8, 9]}
              keyExtractor={item => item.toString()}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.feelsList}
              renderItem={() => (
                <TouchableOpacity>
                  <Image source={IC_PROFILE} style={styles.feelImage} />
                </TouchableOpacity>
              )}
            />
          </View>

          {/* SUGGESTED TITLE */}
          <Text style={styles.suggestedTitle}>Suggested</Text>
        </View>
      }
      renderItem={() => (
        <TouchableOpacity
          onPress={goInbox}
          style={styles.suggestedItem}
        >
          <Image source={IC_PROFILE} style={styles.suggestedAvatar} />
          <Text style={styles.suggestedText}>Raihan</Text>
        </TouchableOpacity>
      )}
    />
  );

  if (value) {
    content = (
      <FlatList
        data={[1, 2, 3, 4, 5, 6, 7, 8, 9]}
        keyExtractor={item => item.toString()}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.mainListContent,
          { paddingBottom: bottom },
        ]}
        ListHeaderComponent={
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {conversationCategories.map((item, index) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => {
                  let updatedConversationCategories =
                    conversationCategories.map(item => ({
                      ...item,
                      active: false,
                    }));
                  updatedConversationCategories[index].active = true;
                  setConversationCategories(updatedConversationCategories);
                }}
                style={[
                  {
                    // borderWidth: 1,
                    // borderColor: colorss.primary,
                    borderRadius: 16,
                    paddingVertical: 4,
                    paddingHorizontal: 16,
                  },
                  item.active && {
                    backgroundColor: colorss.background,
                  },
                ]}
              >
                <Text
                  style={[
                    {
                      color: colorss.textSecondary,
                      fontSize: 14,
                    },
                    item.active && {
                      color: colorss.textPrimary,
                      fontWeight: '500',
                    },
                  ]}
                >
                  {item.title}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        }
        style={{
          marginTop: 20,
        }}
        renderItem={() => (
          <TouchableOpacity
            onPress={goInbox}
            style={styles.suggestedItem}
          >
            <Image source={IC_PROFILE} style={styles.suggestedAvatar} />
            <Text style={styles.suggestedText}>Raihan</Text>
          </TouchableOpacity>
        )}
      />
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <ArrowLeft color={colorss.textPrimary} />
        </TouchableOpacity>

        <View style={styles.searchBox}>
          <SearchIcon size={18} color={colorss.textSecondary} />
          <TextInput
            style={styles.input}
            placeholder="Search messages…"
            placeholderTextColor={colors.textMuted}
            value={value}
            onChangeText={onChangeText}
            returnKeyType="search"
          />
        </View>
      </View>

      {content}
    </SafeAreaView>
  );
};

export default SearchScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colorss.surface,
    paddingTop: 10,
  },

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
    height: 40,
    width: 40,
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

  input: {
    fontSize: 14,
    color: colorss.textSecondary,
    padding: 0,
    width: '100%',
  },

  mainListContent: {
    gap: 10,
    paddingHorizontal: 10,
  },

  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  sectionTitle: {
    fontSize: 14,
    color: colorss.textSecondary,
    marginBottom: 10,
  },

  editText: {
    fontSize: 16,
    color: colorss.accent,
    fontWeight: '500',
  },

  recentSearchContainer: {
    marginVertical: 20,
  },

  recentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
    marginTop: 6,
  },

  recentItem: {
    width: '18%',
    alignItems: 'center',
  },

  recentName: {
    fontSize: 14,
    color: colorss.textPrimary,
    marginTop: 4,
  },

  avatarWrap: {
    position: 'relative',
  },

  avatar: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
  },

  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: radius.full,
    backgroundColor: colors.online,
  },

  feelsContainer: {
    marginBottom: 20,
  },

  feelsList: {
    gap: 10,
  },

  feelImage: {
    width: 100,
    height: 180,
    borderRadius: 8,
  },

  suggestedTitle: {
    fontSize: 14,
    color: colorss.textSecondary,
    marginBottom: 10,
  },

  suggestedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  suggestedAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },

  suggestedText: {
    fontSize: 16,
    fontWeight: '500',
    color: colorss.textPrimary,
  },
});
