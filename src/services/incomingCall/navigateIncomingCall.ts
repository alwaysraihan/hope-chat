import { StackActions } from '@react-navigation/native';

import { navigationRef } from '../../navigation/navigationRef';
import type { IncomingCallPayload } from './payload';

let pendingIncoming: IncomingCallPayload | null = null;
let pendingFlushInterval: ReturnType<typeof setInterval> | null = null;

// Rooms whose call_cancelled FCM arrived in-process. Entries auto-expire in 30 s.
const cancelledRooms = new Set<string>();

function clearPendingFlushTimer(): void {
  if (pendingFlushInterval != null) {
    clearInterval(pendingFlushInterval);
    pendingFlushInterval = null;
  }
}

/** Mark a room as cancelled so stale pending auto-accepts are blocked. */
export function markCallCancelled(liveKitRoom: string): void {
  cancelledRooms.add(liveKitRoom);
  setTimeout(() => cancelledRooms.delete(liveKitRoom), 30_000);
}

/** Returns true if a call_cancelled FCM was received in-process for this room. */
export function isCallCancelled(liveKitRoom: string): boolean {
  return cancelledRooms.has(liveKitRoom);
}

/**
 * Clear any buffered incoming call for this room (called when call_cancelled arrives
 * before nav was ready to open the IncomingCallScreen).
 * Pass no room to unconditionally clear.
 */
export function clearPendingIncomingCall(liveKitRoom?: string): void {
  if (
    liveKitRoom &&
    pendingIncoming &&
    pendingIncoming.liveKitRoom !== liveKitRoom
  ) {
    return;
  }
  clearPendingFlushTimer();
  pendingIncoming = null;
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
  const currentRoom = (current?.params as { liveKitRoom?: string } | undefined)
    ?.liveKitRoom;

  // Same call already showing — no-op.
  if (current?.name === 'IncomingCall' && currentRoom === payload.liveKitRoom) {
    return;
  }

  const routeParams = {
    callKind: payload.callKind,
    liveKitRoom: payload.liveKitRoom,
    displayName: payload.displayName,
    callerId: payload.callerId,
    avatarUrl: payload.avatarUrl,
    conversationId: payload.conversationId,
    autoAccept: payload.autoAccept,
  };

  if (current?.name === 'IncomingCall') {
    // A different call is ringing — replace it so only one IncomingCallScreen
    // is ever in the stack and the old one unmounts (stopping its ringtone).
    navigationRef.dispatch(StackActions.replace('IncomingCall', routeParams));
  } else {
    navigationRef.dispatch(StackActions.push('IncomingCall', routeParams));
  }
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
