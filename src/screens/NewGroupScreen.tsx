import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colorss } from '../theme';
import { useColors } from '../hooks/useColors';
import { Search } from 'lucide-react-native';
import FastImage from '@d11/react-native-fast-image';
import { NativeStackScreenProps } from '@react-navigation/native-stack';


import BackHeader from '../components/BackHeader';
import { IC_PROFILE } from '../assets';
import { RootStackNavigatorParamList } from '../types/navigators';
import { useChats } from '../context/ChatsContext';

type Props = NativeStackScreenProps<RootStackNavigatorParamList, 'NewGroup'>;

export const NewGroupScreen: React.FC<Props> = ({ navigation }) => {
  const colorss = useColors();
  const { conversations, listLoading } = useChats();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  // Only show 1:1 accepted chats that have a known peer
  const contacts = useMemo(
    () =>
      conversations.filter(
        c => !c.isGroup && !c.needsAcceptance && c.peerUserId,
      ),
    [conversations],
  );

  const filtered = useMemo(
    () =>
      contacts.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()),
      ),
    [contacts, search],
  );

  const toggleContact = (userId: string) => {
    setSelectedIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId],
    );
  };

  const selectedContacts = contacts.filter(c =>
    selectedIds.includes(c.peerUserId!),
  );

  const handleNext = () => {
    if (selectedIds.length === 0) return;
    navigation.navigate('GroupSetup', {
      selectedUserIds: selectedIds,
      selectedNames: selectedContacts.map(c => c.name),
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <BackHeader title="New Group" navigation={navigation} />

      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        {/* Selected chips */}
        {selectedContacts.length > 0 && (
          <View style={styles.chipsRow}>
            {selectedContacts.map(c => (
              <TouchableOpacity
                key={c.peerUserId}
                style={styles.chip}
                onPress={() => toggleContact(c.peerUserId!)}
              >
                <Text style={styles.chipText}>{c.name}</Text>
                <Text style={styles.chipX}>×</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.searchBar}>
          <Search size={20} color={colorss.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search"
            placeholderTextColor={colorss.placeholder}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {listLoading ? (
          <ActivityIndicator
            color={colorss.accent}
            style={styles.loader}
          />
        ) : filtered.length === 0 ? (
          <Text style={styles.emptyText}>
            {search
              ? 'No contacts match your search'
              : 'No accepted chats yet.\nStart a chat with someone first.'}
          </Text>
        ) : (
          <View>
            <Text style={styles.section}>People</Text>
            {filtered.map(item => (
              <TouchableOpacity
                key={item.peerUserId}
                style={styles.row}
                onPress={() => toggleContact(item.peerUserId!)}
              >
                <FastImage
                  source={
                    item.avatarUrl
                      ? { uri: item.avatarUrl }
                      : IC_PROFILE
                  }
                  style={styles.avatar}
                  resizeMode={FastImage.resizeMode.cover}
                />
                <Text style={styles.name} numberOfLines={1}>
                  {item.name}
                </Text>
                <View
                  style={[
                    styles.radio,
                    selectedIds.includes(item.peerUserId!)
                      ? styles.radioSelected
                      : null,
                  ]}
                >
                  {selectedIds.includes(item.peerUserId!) && (
                    <Text style={styles.radioCheck}>✓</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {selectedIds.length > 0 && (
        <View style={styles.footer}>
          <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
            <Text style={styles.nextText}>
              Next ({selectedIds.length})
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colorss.white,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
    marginBottom: 12,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colorss.backgroundDeep,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  chipText: {
    color: colorss.textPrimary,
    fontWeight: '500',
    fontSize: 13,
  },
  chipX: {
    color: colorss.textSecondary,
    fontSize: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colorss.white,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: colorss.border,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: colorss.textPrimary,
    fontSize: 15,
  },
  section: {
    color: colorss.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colorss.primary,
  },
  name: {
    flex: 1,
    color: colorss.textPrimary,
    fontSize: 15,
    fontWeight: '500',
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colorss.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    backgroundColor: colorss.accent,
    borderColor: colorss.accent,
  },
  radioCheck: {
    color: colorss.white,
    fontSize: 13,
    fontWeight: '700',
  },
  loader: {
    marginTop: 40,
  },
  emptyText: {
    color: colorss.textSecondary,
    textAlign: 'center',
    marginTop: 40,
    lineHeight: 22,
    fontSize: 14,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colorss.border,
    backgroundColor: colorss.white,
  },
  nextBtn: {
    backgroundColor: colorss.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  nextText: {
    color: colorss.white,
    fontWeight: '700',
    fontSize: 16,
  },
});
