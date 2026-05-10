import { createMMKV, type MMKV } from 'react-native-mmkv';
import { NativeModules } from 'react-native';
import {
  SHARED_HOPENITY_AUTH_MMKV_ENCRYPTION_KEY,
  SHARED_HOPENITY_AUTH_MMKV_STORAGE_ID,
} from '../constants/sharedHopenityAuthVault';

function sharedMMKVDirectory(): string | undefined {
  try {
    const p = NativeModules.CrossAppAuthStorage?.getSharedMMKVDirectorySync?.();
    return typeof p === 'string' && p.length > 0 ? p : undefined;
  } catch {
    return undefined;
  }
}

function buildHopeChatHopenityMMKV(): MMKV {
  const sharedRoot = sharedMMKVDirectory();

  if (sharedRoot) {
    return createMMKV({
      id: SHARED_HOPENITY_AUTH_MMKV_STORAGE_ID,
      path: sharedRoot,
      encryptionKey: SHARED_HOPENITY_AUTH_MMKV_ENCRYPTION_KEY,
    });
  }

  return createMMKV({
    id: SHARED_HOPENITY_AUTH_MMKV_STORAGE_ID,
    encryptionKey: SHARED_HOPENITY_AUTH_MMKV_ENCRYPTION_KEY,
  });
}

let hopenityMmkvSingleton: MMKV | null = null;

/** Single MMKV instance so reads/writes and listeners stay consistent. */
export function getHopeChatHopenityMMKV(): MMKV {
  if (!hopenityMmkvSingleton) {
    hopenityMmkvSingleton = buildHopeChatHopenityMMKV();
  }
  return hopenityMmkvSingleton;
}

export type HopenityPersistedUserBlob = {
  token?: string | null;
  user?: {
    id?: string | number;
    _id?: string | number;
    name?: string;
    username?: string;
    profile_image?: string;
    profile_photo?: string;
    avatar?: string;
    photo?: string;
    image?: string;
  } | null;
  isLogin?: boolean;
};

const USER_KEY = 'user';

export function readPersistedHopenityUser(): HopenityPersistedUserBlob | null {
  try {
    const storage = getHopeChatHopenityMMKV();
    const raw = storage.getString(USER_KEY);
    if (raw == null || raw === '') return null;
    return JSON.parse(raw) as HopenityPersistedUserBlob;
  } catch {
    return null;
  }
}

/** When Hopenity (or this app) updates the `user` key, invoke callback. Returns unsubscribe. */
export function subscribePersistedHopenityUser(
  onChange: (blob: HopenityPersistedUserBlob | null) => void,
): () => void {
  const storage = getHopeChatHopenityMMKV();
  const sub = storage.addOnValueChangedListener(changedKey => {
    if (changedKey !== USER_KEY) return;
    onChange(readPersistedHopenityUser());
  });
  return () => sub.remove();
}

export function persistHopenityUser(blob: HopenityPersistedUserBlob | null): boolean {
  try {
    const storage = getHopeChatHopenityMMKV();
    if (blob == null) {
      storage.remove(USER_KEY);
      return true;
    }
    storage.set(USER_KEY, JSON.stringify(blob));
    return true;
  } catch {
    return false;
  }
}

export function clearPersistedHopenityUser(): boolean {
  return persistHopenityUser(null);
}

export function displayNameFromBlob(b: HopenityPersistedUserBlob | null): string {
  const u = b?.user;
  if (!u || typeof u !== 'object') return 'Hopenity user';
  const n = u.name ?? u.username;
  return (typeof n === 'string' && n.length > 0 ? n : 'Hopenity user') as string;
}

export function avatarFromBlob(b: HopenityPersistedUserBlob | null): string | null {
  const u = b?.user;
  if (!u || typeof u !== 'object') return null;
  return (
    (u.profile_image ||
      u.profile_photo ||
      u.avatar ||
      u.photo ||
      u.image ||
      null) as string | null
  );
}

export function userIdFromBlob(b: HopenityPersistedUserBlob | null): string {
  const u = b?.user;
  if (u && typeof u === 'object') {
    const id = u.id ?? u._id;
    if (id != null && String(id).length > 0) return String(id);
  }
  return 'me';
}

export function isUsableHopenityBlob(
  blob: HopenityPersistedUserBlob | null,
): blob is HopenityPersistedUserBlob & { token: string } {
  const t = blob?.token;
  return typeof t === 'string' && t.length > 0;
}
