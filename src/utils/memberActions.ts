/**
 * Tapping a person in a group (sender name in the thread, or a row in Group
 * Info) used to jump straight out to the Hopenity app. Ask instead: view their
 * Hopenity profile, or message them here in HopeChat.
 */
import { Alert } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackNavigatorParamList } from '../types/navigators';
import type { ConversationSummary } from '../context/ChatsContext';
import { getOrCreatePeerChat } from '../services/chatService';
import { openHopenityProfile } from '../services/hopenityLinking';
import { normalizeChatUserId } from './chatUserId';
import { Toast } from '../components/Toast';

type Nav = NativeStackNavigationProp<RootStackNavigatorParamList>;

export async function openDirectChatWith(params: {
  userId: string;
  name: string;
  avatarUrl?: string | null;
  navigation: Nav;
  token: string | null;
  conversations: ConversationSummary[];
}): Promise<void> {
  const { userId, name, avatarUrl, navigation, token, conversations } = params;
  const existing = conversations.find(
    c =>
      !c.isGroup &&
      c.peerUserId != null &&
      normalizeChatUserId(c.peerUserId) === normalizeChatUserId(userId),
  );
  let conversationId = existing ? String(existing.id) : null;
  if (!conversationId && token) conversationId = await getOrCreatePeerChat(userId, token);
  if (!conversationId) {
    Toast.show("Couldn't open the chat. Please try again.", 'error');
    return;
  }
  // push, not navigate: the group thread is already an 'Inbox' route, and
  // navigate would just swap its params instead of opening the DM on top.
  navigation.push('Inbox', {
    conversationId,
    displayName: name,
    avatarUrl: avatarUrl ?? null,
    seedConversation: existing ?? {
      id: conversationId,
      name,
      avatarUrl: avatarUrl ?? null,
      peerUserId: userId,
      isGroup: false,
      needsAcceptance: false,
      preview: '',
      time: '',
      unreadCount: 0,
      messages: [],
    },
  });
}

export function showMemberActions(params: {
  userId: string;
  name: string;
  avatarUrl?: string | null;
  navigation: Nav;
  token: string | null;
  conversations: ConversationSummary[];
}): void {
  const { userId, name } = params;
  if (!userId || userId === 'unknown') return;
  Alert.alert(name || 'Member', undefined, [
    {
      text: 'View profile',
      onPress: () => {
        openHopenityProfile(userId).catch(() => {});
      },
    },
    {
      text: 'Send message',
      onPress: () => {
        openDirectChatWith(params).catch(() => {});
      },
    },
    { text: 'Cancel', style: 'cancel' },
  ]);
}
