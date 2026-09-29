import { createMMKV, type MMKV } from 'react-native-mmkv';

/**
 * Tracks the currently-active LiveKit call screen so a *second* incoming call can cleanly tear
 * the previous one down before joining the new room. Solves the "two LiveKitRoom instances
 * racing each other" class of bugs when a new call arrives mid-call.
 *
 * Only one call is active at a time. The call screen registers a `leave` thunk on mount and
 * unregisters on unmount. `endActiveCallForReplacement` is awaited from the IncomingCallScreen
 * accept handler.
 */

export type ActiveCallKind = 'audio' | 'video';

type ActiveCallEntry = {
  liveKitRoom: string;
  kind: ActiveCallKind;
  /**
   * Silent teardown: disconnects the room WITHOUT touching navigation. Used when
   * a second call replaces this one and the accept handler resets the stack itself.
   */
  leave: () => Promise<void> | void;
  /**
   * Full hang-up: tears down AND leaves the call screen. Used when the call ends
   * for real (peer declined / hung up) — `leave` alone left the caller staring at
   * a live "Calling…" screen for a call that was already over.
   */
  end?: () => Promise<void> | void;
  /**
   * Everything needed to RE-CREATE the call screen if it is no longer in the
   * navigation stack.
   *
   * Backing out of a call (Android back / swipe) pops the route while the call
   * itself keeps running — the ongoing notification still says "connected". The
   * old recovery path pushed the route with NO params, so the screen mounted
   * without a room, display name or direction and could not rejoin: tapping the
   * notification appeared to do nothing.
   */
  screenParams?: Record<string, unknown>;
};

let current: ActiveCallEntry | null = null;

/**
 * Mirror of the live call on disk.
 *
 * The in-memory registry dies with the JS context, so a notification tap that
 * relaunched a killed process found no call and could not rebuild the screen —
 * the ongoing notification outlives the process (it is a foreground service).
 * MMKV is readable from any context, including the headless one, so the params
 * needed to re-enter the room survive.
 */
let _store: MMKV | null = null;
function store(): MMKV {
  if (!_store) _store = createMMKV({ id: 'hopechat-active-call-v1' });
  return _store;
}

const K_ACTIVE_CALL = 'active_call';
/** A record older than this describes a call that is certainly over. */
const ACTIVE_CALL_MAX_AGE_MS = 6 * 60 * 60_000;

export type PersistedActiveCall = {
  liveKitRoom: string;
  kind: ActiveCallKind;
  screenParams?: Record<string, unknown>;
  at: number;
};

function persist(entry: ActiveCallEntry | null): void {
  try {
    if (!entry) {
      store().remove(K_ACTIVE_CALL);
      return;
    }
    store().set(
      K_ACTIVE_CALL,
      JSON.stringify({
        liveKitRoom: entry.liveKitRoom,
        kind: entry.kind,
        screenParams: entry.screenParams,
        at: Date.now(),
      } satisfies PersistedActiveCall),
    );
  } catch {
    /* persistence is a fallback — never break the call over it */
  }
}

/** The last known live call, for rebuilding the screen after a process restart. */
export function readPersistedActiveCall(): PersistedActiveCall | null {
  try {
    const raw = store().getString(K_ACTIVE_CALL);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedActiveCall;
    if (!parsed?.liveKitRoom) return null;
    if (Date.now() - (parsed.at ?? 0) > ACTIVE_CALL_MAX_AGE_MS) {
      store().remove(K_ACTIVE_CALL);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPersistedActiveCall(): void {
  try {
    store().remove(K_ACTIVE_CALL);
  } catch {
    /* */
  }
}

/** A stalled teardown must never block the next call from starting. */
const LEAVE_TIMEOUT_MS = 2000;

function leaveWithTimeout(entry: ActiveCallEntry): Promise<void> {
  return new Promise<void>(resolve => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const timer = setTimeout(done, LEAVE_TIMEOUT_MS);
    try {
      Promise.resolve(entry.leave())
        .catch(() => undefined)
        .finally(() => {
          clearTimeout(timer);
          done();
        });
    } catch {
      clearTimeout(timer);
      done();
    }
  });
}

/**
 * End the active call for real, screen included. Falls back to the silent
 * teardown for entries registered before `end` existed.
 */
export async function endActiveCallForRemoteHangup(
  liveKitRoom: string,
): Promise<void> {
  const active = current;
  if (!active || active.liveKitRoom !== liveKitRoom) return;
  try {
    await leaveWithTimeout({ ...active, leave: active.end ?? active.leave });
  } catch {
    /* teardown is best-effort — the screen still has to go */
  }
}

/** Drop the registry entry without tearing anything down (screen already gone). */
export function clearActiveCall(liveKitRoom?: string): void {
  clearPersistedActiveCall();
  if (!current) return;
  if (liveKitRoom && current.liveKitRoom !== liveKitRoom) return;
  current = null;
}

export function registerActiveCall(entry: ActiveCallEntry): () => void {
  current = entry;
  persist(entry);
  return () => {
    if (current && current.liveKitRoom === entry.liveKitRoom) {
      current = null;
    }
    // The screen is gone; so is any reason to restore it from disk.
    if (readPersistedActiveCall()?.liveKitRoom === entry.liveKitRoom) {
      clearPersistedActiveCall();
    }
  };
}

export function getActiveCall(): ActiveCallEntry | null {
  return current;
}

/**
 * Used by IncomingCallScreen.accept(): if a previous call is alive, tear it down and clear
 * the registry before the new call screen mounts.
 */
export async function endActiveCallForReplacement(
  newLiveKitRoom: string,
): Promise<void> {
  const active = current;
  if (!active) return;
  if (active.liveKitRoom === newLiveKitRoom) {
    /* Same room — likely a re-entry from the same FCM payload; let the existing screen continue. */
    return;
  }
  try {
    await leaveWithTimeout(active);
  } catch (e) {
    if (__DEV__) console.warn('[activeCallRegistry] leave previous', e);
  } finally {
    if (current && current.liveKitRoom === active.liveKitRoom) {
      current = null;
    }
  }
}
