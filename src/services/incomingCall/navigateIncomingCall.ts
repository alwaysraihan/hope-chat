import { StackActions } from '@react-navigation/native';

import { navigationRef } from '../../navigation/navigationRef';
import type { IncomingCallPayload } from './payload';

let pendingIncoming: IncomingCallPayload | null = null;
let pendingFlushInterval: ReturnType<typeof setInterval> | null = null;

function clearPendingFlushTimer(): void {
  if (pendingFlushInterval != null) {
    clearInterval(pendingFlushInterval);
    pendingFlushInterval = null;
  }
}

/** While nav mounts (cold start / kill recovery), poll so the incoming route opens as soon as possible. */
function schedulePendingFlush(): void {
  clearPendingFlushTimer();
  let ticks = 0;
  pendingFlushInterval = setInterval(() => {
    ticks += 1;
    if (navigationRef.isReady() && pendingIncoming) {
      consumePendingIncomingCall();
    }
    if (ticks > 120) {
      clearPendingFlushTimer();
    }
  }, 100);
}

export function consumePendingIncomingCall(): void {
  if (!navigationRef.isReady() || !pendingIncoming) return;
  clearPendingFlushTimer();
  const p = pendingIncoming;
  pendingIncoming = null;
  openIncomingRoute(p);
}

function openIncomingRoute(payload: IncomingCallPayload): void {
  const current = navigationRef.getCurrentRoute();
  if (
    current?.name === 'IncomingCall' &&
    (current.params as { liveKitRoom?: string } | undefined)?.liveKitRoom ===
      payload.liveKitRoom
  ) {
    return;
  }

  navigationRef.dispatch(
    StackActions.push('IncomingCall', {
      callKind: payload.callKind,
      liveKitRoom: payload.liveKitRoom,
      displayName: payload.displayName,
      callerId: payload.callerId,
      avatarUrl: payload.avatarUrl,
      conversationId: payload.conversationId,
      autoAccept: payload.autoAccept,
    }),
  );
}

export function navigateIncomingCall(payload: IncomingCallPayload): void {
  if (!navigationRef.isReady()) {
    pendingIncoming = payload;
    schedulePendingFlush();
    return;
  }
  clearPendingFlushTimer();
  openIncomingRoute(payload);
}
