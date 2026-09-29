/**
 * Durable store for "user pressed Accept/Decline on the call notification".
 *
 * Why this exists: the notification actions are handled in notifee's BACKGROUND
 * JS context, which is a different context from the running app. The handoff
 * used to rely solely on a native module (`HopeChatCallRingtone`) holding the
 * value in a static field — and every call into it is optional-chained:
 *
 *     native?.setPendingAutoAcceptData?.(json)
 *
 * If that module is not present in the headless context, those calls are a
 * SILENT no-op. Accept then opens the app with nothing to consume, and Decline
 * never signals the caller — which is exactly "the buttons do nothing", with no
 * error anywhere to explain it.
 *
 * MMKV is process-wide and file-backed, so it works across JS contexts and
 * survives a cold start. It is written alongside the native module and read as
 * the fallback, so the flow no longer depends on the native module existing.
 */
import { createMMKV, type MMKV } from 'react-native-mmkv';

let _store: MMKV | null = null;
function store(): MMKV | null {
  try {
    if (!_store) _store = createMMKV({ id: 'hopechat-pending-call-action-v1' });
    return _store;
  } catch {
    return null;
  }
}

const K_ACCEPT = 'auto_accept_json';
const K_REJECT = 'reject_json';

/** Stale actions must never resurrect a long-dead call. */
const MAX_AGE_MS = 2 * 60 * 1000;

function write(key: string, json: string): void {
  try {
    store()?.set(key, JSON.stringify({ at: Date.now(), json }));
  } catch {
    /* best-effort */
  }
}

function readAndClear(key: string): string | null {
  try {
    const s = store();
    const raw = s?.getString(key);
    if (!raw) return null;
    // MMKV v4 has no delete(); an empty string is treated as "no value" on read.
    s?.set(key, '');
    const parsed = JSON.parse(raw) as { at?: number; json?: string };
    if (!parsed?.json) return null;
    if (typeof parsed.at === 'number' && Date.now() - parsed.at > MAX_AGE_MS) {
      return null;
    }
    return parsed.json;
  } catch {
    return null;
  }
}

export function writePendingAutoAccept(json: string): void {
  write(K_ACCEPT, json);
}
export function readPendingAutoAccept(): string | null {
  return readAndClear(K_ACCEPT);
}
export function writePendingReject(json: string): void {
  write(K_REJECT, json);
}
export function readPendingReject(): string | null {
  return readAndClear(K_REJECT);
}
