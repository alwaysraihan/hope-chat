import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colorss } from '../theme';
import { useColors } from '../hooks/useColors';
import FastImage from '@d11/react-native-fast-image';
import { Search } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';


import BackHeader from '../components/BackHeader';
import { IC_PROFILE } from '../assets';
import { RootStackNavigatorParamList } from '../types/navigators';
import { useAppSelector } from '../hooks/redux';
import { selectAuthToken } from '../redux/features/auth/authSlice';
import { addGroupMember } from '../services/groupService';
import { useChats } from '../context/ChatsContext';
import { normalizeChatUserId } from '../utils/chatUserId';

type Props = NativeStackScreenProps<
  RootStackNavigatorParamList,
  'AddGroupMembers'
>;

const AddGroupMembersScreen: React.FC<Props> = ({ navigation, route }) => {
  const colorss = useColors();
  const { groupId, existingMemberIds } = route.params;
  const token = useAppSelector(selectAuthToken);
  const { conversations } = useChats();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);

  const normalizedExisting = useMemo(
    () => new Set(existingMemberIds.map(id => normalizeChatUserId(id) || id)),
    [existingMemberIds],
  );

  // Accepted 1:1 contacts not already in the group
  const contacts = useMemo(
    () =>
      conversations.filter(c => {
        if (c.isGroup || c.needsAcceptance || !c.peerUserId) return false;
        const normalized = normalizeChatUserId(c.peerUserId) || c.peerUserId;
        return !normalizedExisting.has(normalized);
      }),
    [conversations, normalizedExisting],
  );

  const filtered = useMemo(
    () =>
      contacts.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()),
      ),
    [contacts, search],
  );

  const toggleSelect = (userId: string) => {
    setSelectedIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId],
    );
  };

  const handleAdd = async () => {
    if (!token || selectedIds.length === 0) return;
    setBusy(true);
    const results = await Promise.all(
      selectedIds.map(userId => addGroupMember(groupId, userId, token)),
    );
    setBusy(false);
    const failed = results.filter(ok => !ok).length;
    if (failed > 0) {
      Alert.alert(
        'Partial failure',
        `${failed} member(s) could not be added. Try again.`,
      );
    }
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <BackHeader title="Add Members" navigation={navigation} />

      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
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

        {contacts.length === 0 ? (
          <Text style={styles.emptyText}>
            Everyone in your accepted chats is already in this group.
          </Text>
        ) : filtered.length === 0 ? (
          <Text style={styles.emptyText}>No contacts match your search.</Text>
        ) : (
          filtered.map(item => (
            <TouchableOpacity
              key={item.peerUserId}
              style={styles.row}
              onPress={() => toggleSelect(item.peerUserId!)}
            >
              <FastImage
                source={
                  item.avatarUrl ? { uri: item.avatarUrl } : IC_PROFILE
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
          ))
        )}
      </ScrollView>

      {selectedIds.length > 0 && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.addBtn, busy && styles.addBtnBusy]}
            onPress={handleAdd}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color={colorss.white} />
            ) : (
              <Text style={styles.addText}>
                Add {selectedIds.length} Member
                {selectedIds.length !== 1 ? 's' : ''}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

export default AddGroupMembersScreen;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colorss.white,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colorss.white,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: colorss.border,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: colorss.textPrimary,
    fontSize: 15,
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
    backgroundColor: colorss.backgroundDeep,
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
  emptyText: {
    color: colorss.textSecondary,
    textAlign: 'center',
    marginTop: 40,
    fontSize: 14,
    lineHeight: 22,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colorss.border,
    backgroundColor: colorss.white,
  },
  addBtn: {
    backgroundColor: colorss.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addBtnBusy: {
    opacity: 0.6,
  },
  addText: {
    color: colorss.white,
    fontWeight: '700',
    fontSize: 16,
  },
});
