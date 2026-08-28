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
  leave: () => Promise<void> | void;
};

let current: ActiveCallEntry | null = null;

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

/** Drop the registry entry without tearing anything down (screen already gone). */
export function clearActiveCall(liveKitRoom?: string): void {
  if (!current) return;
  if (liveKitRoom && current.liveKitRoom !== liveKitRoom) return;
  current = null;
}

export function registerActiveCall(entry: ActiveCallEntry): () => void {
  current = entry;
  return () => {
    if (current && current.liveKitRoom === entry.liveKitRoom) {
      current = null;
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
