/**
 * hopenitySharedAuth — Secure cross-app session sharing via MMKV.
 *
 * Both Hopenity and HopeChat create an MMKV instance with the SAME:
 *   • id           — 'hopenity-auth'
 *   • encryptionKey — shared secret (AES-256, obfuscated in binary)
 *   • mode          — 'multi-process' (required for cross-app file locking)
 *
 * iOS:  AppGroupIdentifier in Info.plist routes BOTH instances to the shared
 *       App Group container (group.com.hopenity.shared). They literally read
 *       and write the same encrypted file — exactly like Facebook ↔ Messenger.
 *       addOnValueChangedListener fires across apps via NSDistributedNotificationCenter.
 *
 * Android: Each app's sandbox is isolated, so the MMKV file is per-app.
 *          The initial session is seeded by the deep-link handshake
 *          (hopechat://auth?token=...&user=...) from Hopenity. After
 *          persistHopenityUser() writes it into HopeChat's MMKV, subsequent
 *          cold-starts read from this MMKV directly — no network call needed.
 */

import { createMMKV, type MMKV } from 'react-native-mmkv';
import { NativeModules, Platform } from 'react-native';
import {
  SHARED_HOPENITY_AUTH_MMKV_ENCRYPTION_KEY,
  SHARED_HOPENITY_AUTH_MMKV_STORAGE_ID,
} from '../constants/sharedHopenityAuthVault';

// ── MMKV instance ─────────────────────────────────────────────────────────────

/**
 * Resolve the shared MMKV root path (iOS App Group container).
 * Returns undefined on Android or when the App Group isn't configured —
 * MMKV then uses the default location. On iOS with AppGroupIdentifier in
 * Info.plist, MMKV routes automatically even without this explicit path.
 */
function sharedMMKVDirectory(): string | undefined {
  try {
    const p = NativeModules.CrossAppAuthStorage?.getSharedMMKVDirectorySync?.();
    return typeof p === 'string' && p.length > 0 ? p : undefined;
  } catch {
    return undefined;
  }
}

function buildSharedMMKV(): MMKV {
  const sharedRoot = sharedMMKVDirectory();
  return createMMKV({
    id: SHARED_HOPENITY_AUTH_MMKV_STORAGE_ID,
    encryptionKey: SHARED_HOPENITY_AUTH_MMKV_ENCRYPTION_KEY,
    /**
     * 'multi-process' — mandatory for cross-app MMKV access.
     *
     * On iOS: uses POSIX file locking + NSDistributedNotificationCenter so
     *   two processes can safely read/write the shared App Group file and
     *   addOnValueChangedListener fires across app boundaries.
     *
     * On Android: signals MMKV to check file mtime on every read so a
     *   write from the deep-link handler (persistHopenityUser) is visible
     *   to subsequent reads within the same process lifecycle.
     *
     * Ref: https://github.com/mrousavy/react-native-mmkv#app-groups-or-extensions
     */
    mode: 'multi-process',
    /**
     * 'compareBeforeSet' — skip the disk write if the value hasn't changed.
     * Prevents redundant I/O when AuthBootstrap re-hydrates on every focus
     * cycle with an already-persisted token.
     */
    compareBeforeSet: true,
    // Explicit path for the App Group container (iOS). On Android sharedRoot
    // is undefined so MMKV uses the app's default private directory.
    ...(sharedRoot ? { path: sharedRoot } : {}),
  });
}

let _singleton: MMKV | null = null;

/** Returns the single shared MMKV instance (created once, reused everywhere). */
export function getHopeChatHopenityMMKV(): MMKV {
  if (!_singleton) _singleton = buildSharedMMKV();
  return _singleton;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type HopenityPersistedUserBlob = {
  token?: string | null;
  user?: {
    user_id?: string | number;
    userId?: string | number;
    id?: string | number;
    _id?: string | number;
    // Name — multiple field names used by different Hopenity API responses
    name?: string;
    full_name?: string;
    first_name?: string;
    last_name?: string;
    username?: string;
    // Avatar
    image?: string;
    photo?: string;
    photo_url?: string;
    profile_image?: string;
    profile_photo?: string;
    avatar?: string;
    avatar_url?: string;
  } | null;
  isLogin?: boolean;
};

const USER_KEY = 'user';

// ── Android ContentProvider read ───────────────────────────────────────────────

/**
 * On Android, read the session directly from Hopenity's ContentProvider.
 *
 * The ContentProvider (HopenityAuthProvider) is protected by the
 * `com.hopenity.permission.READ_AUTH` signature-level permission, so only
 * apps signed with the same keystore (i.e. HopeChat) can query it.
 *
 * This is the Play-Store-compliant replacement for the deprecated
 * `android:sharedUserId` + `createPackageContext` approach. It works even on
 * a cold start without requiring a prior deep-link handshake from Hopenity.
 *
 * Returns null if Hopenity is not installed, not yet signed in, or if the
 * permission check fails (different signing key — can only happen in dev).
 */
function readFromAndroidContentProvider(): HopenityPersistedUserBlob | null {
  if (Platform.OS !== 'android') return null;
  try {
    const json = NativeModules.CrossAppAuthStorage?.readHopenityAuthSync?.();
    if (typeof json !== 'string' || json.trim() === '') return null;
    return JSON.parse(json) as HopenityPersistedUserBlob;
  } catch {
    return null;
  }
}

// ── Read / Write ──────────────────────────────────────────────────────────────

/**
 * Read the Hopenity session.
 *
 * Android: ContentProvider query → HopenityAuthProvider reads Hopenity's live
 *          MMKV and returns the session JSON over binder IPC. Falls back to
 *          HopeChat's private MMKV (seeded by deep-link) if unavailable.
 * iOS:     App Group shared MMKV — same encrypted file Hopenity wrote directly.
 */
export function readPersistedHopenityUser(): HopenityPersistedUserBlob | null {
  // On Android prefer the ContentProvider — it reads Hopenity's live session
  // without needing a prior deep-link handshake.
  const cpBlob = readFromAndroidContentProvider();
  if (cpBlob) return cpBlob;

  // iOS (App Groups) or Android fallback (private MMKV seeded by deep-link).
  try {
    const raw = getHopeChatHopenityMMKV().getString(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as HopenityPersistedUserBlob;
  } catch {
    return null;
  }
}

/** Write (or clear) the session blob into the shared MMKV. */
export function persistHopenityUser(blob: HopenityPersistedUserBlob | null): boolean {
  try {
    const storage = getHopeChatHopenityMMKV();
    if (blob == null) {
      storage.delete(USER_KEY);
    } else {
      storage.set(USER_KEY, JSON.stringify(blob));
    }
    return true;
  } catch {
    return false;
  }
}

export function clearPersistedHopenityUser(): boolean {
  return persistHopenityUser(null);
}

// ── Live listener ─────────────────────────────────────────────────────────────

/**
 * Subscribe to changes on the 'user' key.
 *
 * iOS + App Groups: fires when Hopenity writes to the shared container
 *   (via NSDistributedNotificationCenter in multi-process mode). This is
 *   what makes HopeChat react to Hopenity login/logout in real time.
 *
 * Android: fires only when this process writes — used for post-deep-link
 *   cache updates and for the logout propagation within HopeChat.
 */
export function subscribePersistedHopenityUser(
  onChange: (blob: HopenityPersistedUserBlob | null) => void,
): () => void {
  const sub = getHopeChatHopenityMMKV().addOnValueChangedListener(key => {
    if (key !== USER_KEY) return;
    onChange(readPersistedHopenityUser());
  });
  return () => sub.remove();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Extract the best available display name for "Continue as {name}".
 * Mirrors the multi-field extraction in HopeChatLauncher.ts (Hopenity side).
 * Priority: name → full_name → first+last → username → fallback.
 */
export function displayNameFromBlob(b: HopenityPersistedUserBlob | null): string {
  const u = b?.user;
  if (!u || typeof u !== 'object') return 'Hopenity user';

  if (typeof u.name === 'string' && u.name.trim()) return u.name.trim();
  if (typeof u.full_name === 'string' && u.full_name.trim()) return u.full_name.trim();

  const joined = [u.first_name, u.last_name]
    .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    .join(' ')
    .trim();
  if (joined) return joined;

  if (typeof u.username === 'string' && u.username.trim()) return u.username.trim();
  return 'Hopenity user';
}

/** Pick the first http(s) avatar URL from the user blob. */
export function avatarFromBlob(b: HopenityPersistedUserBlob | null): string | null {
  const u = b?.user;
  if (!u) return null;
  const candidates = [
    u.profile_image, u.profile_photo, u.avatar, u.avatar_url,
    u.image, u.photo, u.photo_url,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && (c.startsWith('http://') || c.startsWith('https://'))) {
      return c;
    }
  }
  return null;
}

export function userIdFromBlob(b: HopenityPersistedUserBlob | null): string {
  const u = b?.user;
  if (u) {
    const id = u.user_id ?? u.userId ?? u.id ?? u._id;
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
