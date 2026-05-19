/**
 * Persists the user's "Continue as {name}" confirmation so HopeChat can auto-login
 * on subsequent launches without showing the confirmation screen each time.
 *
 * Flow:
 *  1. First launch (or after logout): show "Continue as {name}" — user must tap.
 *  2. On success: call markAutoLoginAcked() to store the flag.
 *  3. Subsequent launches: if flag is set AND a valid Hopenity session exists,
 *     auto-login immediately (skip the confirmation UI).
 *  4. On logout: call clearAutoLoginAck() so the process repeats next time.
 */

import { createMMKV } from 'react-native-mmkv';

const LOCAL_STORAGE_ID = 'hopechat_local_prefs';
const AUTO_LOGIN_ACK_KEY = 'auto_login_acked';

let _storage: ReturnType<typeof createMMKV> | null = null;

function getStorage() {
  if (!_storage) {
    _storage = createMMKV({ id: LOCAL_STORAGE_ID });
  }
  return _storage;
}

export function isAutoLoginAcked(): boolean {
  try {
    return getStorage().getString(AUTO_LOGIN_ACK_KEY) === '1';
  } catch {
    return false;
  }
}

export function markAutoLoginAcked(): void {
  try {
    getStorage().set(AUTO_LOGIN_ACK_KEY, '1');
  } catch {
    /* non-fatal */
  }
}

export function clearAutoLoginAck(): void {
  try {
    getStorage().delete(AUTO_LOGIN_ACK_KEY);
  } catch {
    /* non-fatal */
  }
}
