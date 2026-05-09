import { createMMKV } from 'react-native-mmkv';
import { NativeModules, Platform } from 'react-native';

/** Must match Hopenity `Src/Application/Storage/MMKVStorage.ts`. */
const AUTH_MMKV_ID = 'hopenity-auth';
const AUTH_ENCRYPTION_KEY = 'hopenity-auth!1';

function iosSharedDirectory(): string | undefined {
  try {
    const p =
      NativeModules.CrossAppAuthStorage?.getSharedMMKVDirectorySync?.();
    return typeof p === 'string' && p.length > 0 ? p : undefined;
  } catch {
    return undefined;
  }
}

/** MMKV instance readable on iOS when both apps use App Group `group.com.hopenity.shared`. */
export function createHopeChatHopenityMMKV() {
  const sharedRoot = Platform.OS === 'ios' ? iosSharedDirectory() : undefined;

  if (sharedRoot) {
    return createMMKV({
      id: AUTH_MMKV_ID,
      path: sharedRoot,
      encryptionKey: AUTH_ENCRYPTION_KEY,
    });
  }

  return createMMKV({
    id: `${AUTH_MMKV_ID}-hope-local`,
    encryptionKey: AUTH_ENCRYPTION_KEY,
  });
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

export function readPersistedHopenityUser(): HopenityPersistedUserBlob | null {
  try {
    const storage = createHopeChatHopenityMMKV();
    const raw = storage.getString('user');
    if (raw == null || raw === '') return null;
    return JSON.parse(raw) as HopenityPersistedUserBlob;
  } catch {
    return null;
  }
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
