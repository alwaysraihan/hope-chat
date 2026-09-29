import { createMMKV, type MMKV } from 'react-native-mmkv';

/**
 * Emitted the moment the ongoing-call notification is tapped.
 *
 * The MMKV flag below is only read on mount and on an AppState change to
 * 'active'. That is enough when the app was genuinely backgrounded, but NOT
 * when the call screen was merely backed out of: the app stays 'active' the
 * whole time the user pulls down the shade and taps, so no transition ever
 * happens and the flag sits there unread — the tap did nothing.
 *
 * While the app is alive, notifee's background and foreground handlers share
 * one JS runtime, so an event emitted from either reaches this listener
 * immediately. The flag remains the fallback for the app-was-killed case.
 */
export const OPEN_ACTIVE_CALL_EVENT = 'hopechat:open-active-call';

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
/** Which call to return to, so the screen can be rebuilt if it is gone. */
const K_OPEN_ACTIVE_CALL_DATA = 'open_active_call_data';

export type PendingCallScreenData = {
  liveKitRoom: string;
  callKind: string;
  displayName: string;
};

/** Valid for a short window — a stale flag must never yank the user into a call screen later. */
const MAX_AGE_MS = 30_000;

export function setPendingOpenActiveCall(data?: PendingCallScreenData): void {
  try {
    store().set(K_OPEN_ACTIVE_CALL, Date.now());
    store().set(K_OPEN_ACTIVE_CALL_DATA, data ? JSON.stringify(data) : '');
  } catch {
    /* best-effort */
  }
}

/** The call the pending open refers to, if the notification identified one. */
export function consumePendingOpenActiveCallData(): PendingCallScreenData | null {
  try {
    const raw = store().getString(K_OPEN_ACTIVE_CALL_DATA);
    // MMKV v4 has no delete(); an empty string is the cleared state.
    store().set(K_OPEN_ACTIVE_CALL_DATA, '');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingCallScreenData;
    return parsed?.liveKitRoom ? parsed : null;
  } catch {
    return null;
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
