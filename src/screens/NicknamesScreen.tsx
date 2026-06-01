import {
  FlatList,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import React, { useCallback, useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import FastImage from '@d11/react-native-fast-image';
import { IC_PROFILE } from '../assets';
import BackHeader from '../components/BackHeader';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackNavigatorParamList } from '../types/navigators';
import { useColors } from '../hooks/useColors';
import { useChats } from '../context/ChatsContext';
import { useAppSelector } from '../hooks/redux';
import { selectHopenityProfile } from '../redux/features/auth/authSlice';
import { createMMKV } from 'react-native-mmkv';

type Props = NativeStackScreenProps<RootStackNavigatorParamList, 'Nicknames'>;

const nicknameStore = createMMKV({ id: 'hopechat-nicknames-v1' });

function getNickname(conversationId: string, userId: string): string {
  return nicknameStore.getString(`${conversationId}::${userId}`) ?? '';
}

function setNickname(conversationId: string, userId: string, nick: string): void {
  const key = `${conversationId}::${userId}`;
  if (nick.trim()) {
    nicknameStore.set(key, nick.trim());
  } else {
    nicknameStore.delete(key);
  }
}

type Participant = {
  userId: string;
  name: string;
  image: string | null;
};

const NicknamesScreen: React.FC<Props> = ({ navigation, route }) => {
  const colorss = useColors();
  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colorss.background },
    headerWrapper: { marginBottom: 4 },
    info: { color: colorss.textSecondary, fontSize: 13, lineHeight: 18, paddingHorizontal: 20, paddingBottom: 12 },
    contentContainer: { paddingBottom: 20 },
    itemContainer: {
      flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, gap: 12,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colorss.border,
    },
    avatar: { width: 46, height: 46, borderRadius: 23 },
    itemText: { flex: 1 },
    title: { fontSize: 15, fontWeight: '600', color: colorss.textPrimary },
    subtitle: { marginTop: 2, fontSize: 13, color: colorss.textSecondary },
    empty: { paddingVertical: 40, alignItems: 'center', paddingHorizontal: 32 },
    emptyText: { color: colorss.textSecondary, textAlign: 'center', lineHeight: 20 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
    modalContainer: { width: '100%', backgroundColor: colorss.cardBg, borderRadius: 16, padding: 22 },
    modalTitle: { fontSize: 17, fontWeight: '700', color: colorss.textPrimary, marginBottom: 6 },
    modalSubtitle: { fontSize: 13, color: colorss.textSecondary, marginBottom: 16 },
    input: { borderBottomWidth: 1.5, borderBottomColor: colorss.accent, fontSize: 16, color: colorss.textPrimary, paddingVertical: 6, marginBottom: 8 },
    actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 20, gap: 8 },
    actionBtn: { paddingVertical: 8, paddingHorizontal: 12 },
    actionText: { fontSize: 15, fontWeight: '600' },
  }), [colorss]);

  const conversationId = route.params?.conversationId ?? '';
  const profile = useAppSelector(selectHopenityProfile);
  const myUserId = profile?.userId ?? '';
  const { conversations } = useChats();

  const participants = useMemo<Participant[]>(() => {
    const conv = conversations.find(c => c.id === conversationId);
    if (!conv) return [];

    // For group chats: collect all participants except self
    if (conv.isGroup) {
      // The participants come from the server; for display we use what's in peerUserId
      // plus any data exposed via ConversationSummary. For groups we'll show what we have.
      return [];
    }

    // For 1:1 chats: show just the peer
    if (conv.peerUserId && conv.peerUserId !== myUserId) {
      return [{
        userId: conv.peerUserId,
        name: conv.name,
        image: conv.avatarUrl ?? null,
      }];
    }
    return [];
  }, [conversations, conversationId, myUserId]);

  const [nicknames, setNicknamesState] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    participants.forEach(p => {
      const n = getNickname(conversationId, p.userId);
      if (n) map[p.userId] = n;
    });
    return map;
  });

  const [editing, setEditing] = useState<Participant | null>(null);
  const [draft, setDraft] = useState('');

  const openEdit = useCallback((p: Participant) => {
    setEditing(p);
    setDraft(nicknames[p.userId] ?? '');
  }, [nicknames]);

  const handleSave = useCallback(() => {
    if (!editing) return;
    setNickname(conversationId, editing.userId, draft);
    setNicknamesState(prev => ({
      ...prev,
      [editing.userId]: draft.trim(),
    }));
    Keyboard.dismiss();
    setEditing(null);
  }, [editing, draft, conversationId]);

  const handleCancel = useCallback(() => {
    Keyboard.dismiss();
    setEditing(null);
  }, []);

  const renderItem = ({ item }: { item: Participant }) => {
    const nick = nicknames[item.userId];
    return (
      <Pressable
        onPress={() => openEdit(item)}
        style={styles.itemContainer}
        android_ripple={{ color: colorss.backgroundDeep }}
      >
        <FastImage
          source={item.image ? { uri: item.image } : IC_PROFILE}
          style={styles.avatar}
          resizeMode={FastImage.resizeMode.cover}
        />
        <View style={styles.itemText}>
          <Text style={styles.title}>{item.name}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {nick ? `Nickname: ${nick}` : 'Tap to set a nickname'}
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={participants}
        keyExtractor={item => item.userId}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.headerWrapper}>
            <BackHeader title="Nicknames" navigation={navigation} />
            <Text style={styles.info}>
              Nicknames are only visible to you in this conversation.
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {conversationId
                ? 'No participants found.'
                : 'Open this screen from inside a chat to set nicknames.'}
            </Text>
          </View>
        }
        contentContainerStyle={styles.contentContainer}
        renderItem={renderItem}
      />

      <Modal visible={editing !== null} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>
                {editing?.name ? `Nickname for ${editing.name}` : 'Set nickname'}
              </Text>
              <Text style={styles.modalSubtitle}>
                Only you can see this nickname.
              </Text>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Enter a nickname…"
                placeholderTextColor={colorss.placeholder}
                style={styles.input}
                autoFocus
                maxLength={50}
                returnKeyType="done"
                onSubmitEditing={handleSave}
              />
              <View style={styles.actions}>
                <Pressable onPress={handleCancel} style={styles.actionBtn}>
                  <Text style={[styles.actionText, { color: colorss.textSecondary }]}>Cancel</Text>
                </Pressable>
                <Pressable onPress={handleSave} style={styles.actionBtn}>
                  <Text style={[styles.actionText, { color: colorss.accent }]}>Save</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
};

export default NicknamesScreen;

