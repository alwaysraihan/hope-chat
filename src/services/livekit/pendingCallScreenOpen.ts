import { createMMKV, type MMKV } from 'react-native-mmkv';

/**
 * Bridges "user tapped the ongoing-call notification" from the *background* JS
 * context to the main app context.
 *
 * Notifee delivers presses to `onBackgroundEvent` while the app is backgrounded,
 * and that context has no navigation. MMKV is file-backed, so the flag written
 * there is visible to the main context as soon as the app foregrounds.
 */
let _store: MMKV | null = null;
function store(): MMKV {
  if (!_store) _store = createMMKV({ id: 'hopechat-call-nav-v1' });
  return _store;
}

const K_OPEN_ACTIVE_CALL = 'open_active_call_at';

/** Valid for a short window — a stale flag must never yank the user into a call screen later. */
const MAX_AGE_MS = 30_000;

export function setPendingOpenActiveCall(): void {
  try {
    store().set(K_OPEN_ACTIVE_CALL, Date.now());
  } catch {
    /* best-effort */
  }
}

export function consumePendingOpenActiveCall(): boolean {
  try {
    const at = store().getNumber(K_OPEN_ACTIVE_CALL);
    if (at == null) return false;
    store().set(K_OPEN_ACTIVE_CALL, 0);
    return at > 0 && Date.now() - at < MAX_AGE_MS;
  } catch {
    return false;
  }
}
