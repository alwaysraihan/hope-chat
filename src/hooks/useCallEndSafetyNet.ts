import { useEffect, useRef } from 'react';

import { navigationRef } from '../navigation/navigationRef';
import { store } from '../redux/store';
import { isCallTransitioning } from '../services/callTransitionGuard';
import {
  callEndSignalledSince,
  notifyCallEndedByRoom,
} from '../services/invitePeerToHopeChatCall';
import { getActiveCall } from '../services/livekit/activeCallRegistry';

/** Long enough for a replacement call screen (audio ↔ video) to mount. */
const SETTLE_MS = 1200;

function navHasCallScreenFor(liveKitRoom: string): boolean {
  const walk = (state: unknown): boolean => {
    const routes = (state as { routes?: unknown[] } | undefined)?.routes ?? [];
    return routes.some(r => {
      const route = r as { name?: string; params?: { liveKitRoom?: string }; state?: unknown };
      if (
        (route.name === 'AudioCall' || route.name === 'VideoCall') &&
        route.params?.liveKitRoom === liveKitRoom
      ) {
        return true;
      }
      return route.state ? walk(route.state) : false;
    });
  };
  try {
    return navigationRef.isReady() ? walk(navigationRef.getRootState()) : false;
  } catch {
    return false;
  }
}

/**
 * Guarantees the other side hears that this call screen is gone.
 *
 * The in-room hang-up sends the end signal, but several exits never reach it:
 * closing "Cannot start call", a connect that fails (LiveKit's onDisconnected /
 * onError just pop the screen), the error boundary, or backing out while still
 * "Connecting…". The invite had already gone out in every one of those, so the
 * other phone kept ringing — "I cut the call and theirs keeps ringing".
 *
 * On unmount, if nothing signalled the end for this room since the screen
 * opened, signal it. Skipped when the call merely moved to another screen
 * (audio ↔ video switch, call handover).
 */
export function useCallEndSafetyNet(liveKitRoom: string | undefined): void {
  const mountedAtRef = useRef(Date.now());
  const roomRef = useRef(liveKitRoom);
  roomRef.current = liveKitRoom;

  useEffect(() => {
    const mountedAt = mountedAtRef.current;
    return () => {
      const room = String(roomRef.current ?? '').trim();
      if (!room) return;
      const transitioningAtUnmount = isCallTransitioning();
      setTimeout(() => {
        if (transitioningAtUnmount || isCallTransitioning()) return;
        if (callEndSignalledSince(room, mountedAt)) return;
        if (getActiveCall()?.liveKitRoom === room) return;
        if (navHasCallScreenFor(room)) return;
        void notifyCallEndedByRoom({
          token: store.getState().auth.token,
          liveKitRoom: room,
        });
      }, SETTLE_MS);
    };
  }, []);
}
