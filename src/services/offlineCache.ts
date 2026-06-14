import { createMMKV, type MMKV } from 'react-native-mmkv';
import type { ConversationSummary } from '../context/ChatsContext';
import type { ExtendedMessage } from '../components/types/chat';
import type { StoryRing } from '../data/storyFeedCache';

let _storage: MMKV | null = null;
function storage(): MMKV {
  if (!_storage) _storage = createMMKV({ id: 'hopechat-offline-cache' });
  return _storage;
}

function dirKey(userId: string): string {
  return `chat_dir_v1_${userId}`;
}

function threadPage1Key(conversationId: string): string {
  return `thread_p1_v1_${conversationId}`;
}

function requestsKey(userId: string): string {
  return `msg_requests_v1_${userId}`;
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
  const raw = storage().getString(dirKey(userId));
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
    storage().set(dirKey(userId), JSON.stringify(rows));
  } catch (e) {
    console.warn('[offlineCache] writeChatDirectoryCache', e);
  }
}

export function readThreadMessagesCache(
  conversationId: string,
): ExtendedMessage[] | null {
  if (!conversationId) return null;
  const raw = storage().getString(threadPage1Key(conversationId));
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
    storage().set(threadPage1Key(conversationId), payload);
  } catch (e) {
    console.warn('[offlineCache] writeThreadMessagesCache', e);
  }
}

// ─── Locally hidden conversations (deleted / archived) ───────────────────────
// Persists across reloads so that reloadConversations() can't restore a chat
// the user explicitly removed — even when the server still returns it (e.g.
// while the backend delete/archive endpoint hasn't been deployed yet).

const HIDDEN_CONVS_KEY = 'hidden_conversations_v1';

export function addHiddenConversation(id: string): void {
  if (!id) return;
  try {
    const existing = getHiddenConversationIds();
    const next = Array.from(new Set([...existing, id]));
    storage().set(HIDDEN_CONVS_KEY, JSON.stringify(next));
  } catch { /* best-effort */ }
}

export function removeHiddenConversation(id: string): void {
  if (!id) return;
  try {
    const existing = getHiddenConversationIds();
    storage().set(HIDDEN_CONVS_KEY, JSON.stringify(existing.filter(x => x !== id)));
  } catch { /* best-effort */ }
}

export function getHiddenConversationIds(): string[] {
  try {
    const raw = storage().getString(HIDDEN_CONVS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

// ─── Story feed cache ─────────────────────────────────────────────────────────

function storyFeedKey(userId: string): string {
  return `story_feed_v1_${userId}`;
}

export function readStoryFeedCache(userId: string): StoryRing[] | null {
  if (!userId || userId === 'me') return null;
  const raw = storage().getString(storyFeedKey(userId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as StoryRing[]) : null;
  } catch {
    return null;
  }
}

export function writeStoryFeedCache(userId: string, rings: StoryRing[]): void {
  if (!userId || userId === 'me') return;
  try {
    storage().set(storyFeedKey(userId), JSON.stringify(rings));
  } catch (e) {
    console.warn('[offlineCache] writeStoryFeedCache', e);
  }
}

// ─── Notifications cache ───────────────────────────────────────────────────────

function notificationsKey(userId: string): string {
  return `notifications_v1_${userId}`;
}

export function readNotificationsCache(userId: string): unknown[] | null {
  if (!userId || userId === 'me') return null;
  const raw = storage().getString(notificationsKey(userId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeNotificationsCache(userId: string, items: unknown[]): void {
  if (!userId || userId === 'me') return;
  try {
    storage().set(notificationsKey(userId), JSON.stringify(items));
  } catch (e) {
    console.warn('[offlineCache] writeNotificationsCache', e);
  }
}

// ─── Message requests cache ───────────────────────────────────────────────────

export function readRequestsCache(userId: string): unknown[] | null {
  if (!userId || userId === 'me') return null;
  const raw = storage().getString(requestsKey(userId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeRequestsCache(userId: string, items: unknown[]): void {
  if (!userId || userId === 'me') return;
  try {
    storage().set(requestsKey(userId), JSON.stringify(items));
  } catch (e) {
    console.warn('[offlineCache] writeRequestsCache', e);
  }
}

// ─── Thread messages cache ────────────────────────────────────────────────────

/** Append a local-only group system event (member joined/left) to the thread cache. */
export function appendGroupSystemMessage(
  conversationId: string,
  text: string,
): void {
  if (!conversationId) return;
  const msg: ExtendedMessage = {
    _id: `group_evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    text,
    createdAt: new Date(),
    user: { _id: 'system', name: 'System' },
    system: true,
  };
  const existing = readThreadMessagesCache(conversationId) ?? [];
  writeThreadMessagesCache(conversationId, [...existing, msg]);
}

/** Append a local-only call row (asc order: newest at end, matching server page cache). */
export function appendCallLogToThreadCache(
  conversationId: string,
  msg: ExtendedMessage,
): void {
  if (!conversationId) return;
  const existing = readThreadMessagesCache(conversationId) ?? [];
  writeThreadMessagesCache(conversationId, [...existing, msg]);
}

function messageTimeMs(m: ExtendedMessage): number {
  const raw = m.createdAt as unknown;
  if (raw instanceof Date) return raw.getTime();
  const d = new Date(raw as string | number);
  return Number.isFinite(d.getTime()) ? d.getTime() : 0;
}

/** Keep client-only `call_evt_*` rows when hydrating from the server (same thread). */
export function mergeLocalCallLogsFromCache(
  conversationId: string,
  serverAsc: ExtendedMessage[],
): ExtendedMessage[] {
  const cached = readThreadMessagesCache(conversationId) ?? [];
  const serverIds = new Set(serverAsc.map(m => String(m._id)));
  const extra = cached.filter(
    m =>
      m.messageKind === 'call_log' &&
      String(m._id).startsWith('call_evt_') &&
      !serverIds.has(String(m._id)),
  );
  if (extra.length === 0) return serverAsc;
  const merged = [...serverAsc, ...extra];
  merged.sort((a, b) => messageTimeMs(a) - messageTimeMs(b));
  return merged;
}
