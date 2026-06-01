/**
 * MMKV-backed search history for HopeChat.
 * Stores the last 20 users the current user has searched/chatted from the
 * search screen. Each entry carries enough info to render the row without
 * an extra API call.
 *
 * IMPORTANT: createMMKV is called lazily (on first access) so it never runs
 * at module-evaluation time — before the React Native bridge is ready.
 */
import { createMMKV, type MMKV } from 'react-native-mmkv';

const KEY = 'history';
const MAX = 20;

let _store: MMKV | null = null;
function store(): MMKV {
  if (!_store) _store = createMMKV({ id: 'hopechat-search-history-v1' });
  return _store;
}

export type SearchHistoryEntry = {
  userId: string;
  name: string;
  username?: string | null;
  image?: string | null;
  savedAt: number;
};

function readAll(): SearchHistoryEntry[] {
  try {
    const raw = store().getString(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(entries: SearchHistoryEntry[]): void {
  store().set(KEY, JSON.stringify(entries));
}

/** Get all recent search entries, newest first. */
export function getSearchHistory(): SearchHistoryEntry[] {
  return readAll().sort((a, b) => b.savedAt - a.savedAt);
}

/** Add or bump a user to the top of the history. */
export function addToSearchHistory(user: {
  userId: string;
  name: string;
  username?: string | null;
  image?: string | null;
}): void {
  const existing = readAll().filter(e => e.userId !== user.userId);
  const entry: SearchHistoryEntry = {
    userId: user.userId,
    name: user.name,
    username: user.username ?? null,
    image: user.image ?? null,
    savedAt: Date.now(),
  };
  writeAll([entry, ...existing].slice(0, MAX));
}

/** Remove one entry by userId. */
export function removeFromSearchHistory(userId: string): void {
  writeAll(readAll().filter(e => e.userId !== userId));
}

/** Wipe all history. */
export function clearSearchHistory(): void {
  store().delete(KEY);
}
