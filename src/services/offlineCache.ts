import { createMMKV } from 'react-native-mmkv';
import type { ConversationSummary } from '../context/ChatsContext';
import type { ExtendedMessage } from '../components/types/chat';

const storage = createMMKV({ id: 'hopechat-offline-cache' });

function dirKey(userId: string): string {
  return `chat_dir_v1_${userId}`;
}

function threadPage1Key(conversationId: string): string {
  return `thread_p1_v1_${conversationId}`;
}

function reviveMessage(m: ExtendedMessage): ExtendedMessage {
  const raw = m.createdAt as unknown;
  const d =
    raw instanceof Date
      ? raw
      : typeof raw === 'string' || typeof raw === 'number'
        ? new Date(raw)
        : new Date();
  return { ...m, createdAt: d };
}

function reviveConversationSummary(row: ConversationSummary): ConversationSummary {
  return {
    ...row,
    messages: (row.messages ?? []).map(reviveMessage),
  };
}

export function readChatDirectoryCache(userId: string): ConversationSummary[] | null {
  if (!userId || userId === 'me') return null;
  const raw = storage.getString(dirKey(userId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.map(reviveConversationSummary);
  } catch {
    return null;
  }
}

export function writeChatDirectoryCache(
  userId: string,
  rows: ConversationSummary[],
): void {
  if (!userId || userId === 'me') return;
  try {
    storage.set(dirKey(userId), JSON.stringify(rows));
  } catch (e) {
    console.warn('[offlineCache] writeChatDirectoryCache', e);
  }
}

export function readThreadMessagesCache(
  conversationId: string,
): ExtendedMessage[] | null {
  if (!conversationId) return null;
  const raw = storage.getString(threadPage1Key(conversationId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.map(m => reviveMessage(m as ExtendedMessage));
  } catch {
    return null;
  }
}

export function writeThreadMessagesCache(
  conversationId: string,
  messagesAsc: ExtendedMessage[],
): void {
  if (!conversationId) return;
  try {
    const payload = JSON.stringify(messagesAsc, (_k, v) =>
      v instanceof Date ? v.toISOString() : v,
    );
    storage.set(threadPage1Key(conversationId), payload);
  } catch (e) {
    console.warn('[offlineCache] writeThreadMessagesCache', e);
  }
}
