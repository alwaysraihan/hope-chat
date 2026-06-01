import { createMMKV, type MMKV } from 'react-native-mmkv';

let _store: MMKV | null = null;
function store(): MMKV {
  if (!_store) _store = createMMKV({ id: 'hopechat-nicknames-v1' });
  return _store;
}

export function getLocalNickname(conversationId: string, userId: string): string {
  return store().getString(`${conversationId}::${userId}`) ?? '';
}

export function setLocalNickname(conversationId: string, userId: string, nick: string): void {
  const key = `${conversationId}::${userId}`;
  if (nick.trim()) {
    store().set(key, nick.trim());
  } else {
    store().delete(key);
  }
}
