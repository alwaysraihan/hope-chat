import { StackActions } from '@react-navigation/native';

import { navigationRef } from '../../navigation/navigationRef';
import { getActiveCall } from '../livekit/activeCallRegistry';
import type { IncomingCallPayload } from './payload';

let pendingIncoming: IncomingCallPayload | null = null;
let pendingFlushInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Rooms whose call_cancelled arrived in-process, keyed to WHEN the cancel was
 * issued.
 *
 * The LiveKit room name is derived from the two user ids, so it is the same for
 * every call this pair ever makes. Treating "room X is cancelled" as a blanket
 * ban therefore silenced the *next* call between the same people — which is why
 * an immediate retry after an unanswered call never rang. A cancel can only
 * invalidate invites that were sent before it.
 */
const cancelledRooms = new Map<string, number>();

/** Housekeeping bound — a cancel older than this can never match a live invite. */
const CANCEL_ENTRY_TTL_MS = 5 * 60_000;

/**
 * How long a cancel suppresses invites that carry no server timestamp. Short on
 * purpose: a redelivered duplicate lands within seconds, a retry does not.
 */
const UNDATED_SUPPRESSION_MS = 8_000;

function clearPendingFlushTimer(): void {
  if (pendingFlushInterval != null) {
    clearInterval(pendingFlushInterval);
    pendingFlushInterval = null;
  }
}

/**
 * Mark the *current* call in this room as cancelled.
 * `cancelledAtMs` should be the cancel event's server timestamp when there is one.
 */
export function markCallCancelled(
  liveKitRoom: string,
  cancelledAtMs: number = Date.now(),
): void {
  if (!liveKitRoom) return;
  const prev = cancelledRooms.get(liveKitRoom) ?? 0;
  // Keep the latest cancel — an older one must never shrink the window.
  cancelledRooms.set(liveKitRoom, Math.max(prev, cancelledAtMs));
  setTimeout(() => {
    const at = cancelledRooms.get(liveKitRoom);
    if (at != null && Date.now() - at >= CANCEL_ENTRY_TTL_MS) {
      cancelledRooms.delete(liveKitRoom);
    }
  }, CANCEL_ENTRY_TTL_MS);
}

/**
 * Calls this device ANSWERED, per room: when, and the answered invite's server
 * timestamp.
 *
 * Every invite reaches the phone more than once (socket + FCM, sometimes a VoIP
 * push too). Duplicates were only ignored while the call screen had registered
 * the active call — and that registry is empty while the call is connecting and
 * after the user minimises it. A late copy of the invite then reopened the
 * incoming-call screen mid-call: "it keeps ringing after I picked up".
 */
const answeredRooms = new Map<string, { at: number; inviteSentAtMs?: number }>();

/** Undated duplicates of an answered invite are dropped for this long. */
const ANSWERED_UNDATED_SUPPRESSION_MS = 90_000;
const ANSWERED_ENTRY_TTL_MS = 3 * 60 * 60_000;

export function markCallAnswered(liveKitRoom: string, inviteSentAtMs?: number): void {
  if (!liveKitRoom) return;
  answeredRooms.set(liveKitRoom, { at: Date.now(), inviteSentAtMs });
  setTimeout(() => {
    const e = answeredRooms.get(liveKitRoom);
    if (e && Date.now() - e.at >= ANSWERED_ENTRY_TTL_MS) answeredRooms.delete(liveKitRoom);
  }, ANSWERED_ENTRY_TTL_MS);
}

/**
 * True when this invite is a copy of a call already answered here. An invite
 * the server stamped AFTER the answered one is a new call and still rings.
 */
export function isCallAnswered(liveKitRoom: string, sentAtMs?: number): boolean {
  const e = answeredRooms.get(liveKitRoom);
  if (!e) return false;
  if (sentAtMs != null && e.inviteSentAtMs != null) return sentAtMs <= e.inviteSentAtMs;
  return Date.now() - e.at < ANSWERED_UNDATED_SUPPRESSION_MS;
}

/** Clear the cancel record — used when we knowingly start a new call in this room. */
export function clearCallCancelled(liveKitRoom: string): void {
  cancelledRooms.delete(liveKitRoom);
}

/**
 * True when an invite is superseded by a cancel for the same room.
 *
 * @param sentAtMs when the invite was sent (server `ts`). An invite sent AFTER
 * the cancel is a new call and is always allowed through.
 */
export function isCallCancelled(
  liveKitRoom: string,
  sentAtMs?: number,
): boolean {
  const cancelledAt = cancelledRooms.get(liveKitRoom);
  if (cancelledAt == null) return false;
  if (sentAtMs != null) return sentAtMs <= cancelledAt;
  // No timestamp to compare: only suppress within the duplicate-delivery window.
  return Date.now() - cancelledAt < UNDATED_SUPPRESSION_MS;
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
  // The call was cancelled while this event was in flight (duplicate socket +
  // FCM delivery, or a cancel that overtook the ring). Never open a dead room.
  if (
    payload.liveKitRoom &&
    (isCallCancelled(payload.liveKitRoom, payload.sentAtMs) ||
      isCallAnswered(payload.liveKitRoom, payload.sentAtMs))
  ) {
    return;
  }

  // Already talking in this very room — a re-delivered invite must not throw a
  // ringing screen on top of the live call.
  const active = getActiveCall();
  if (active && payload.liveKitRoom && active.liveKitRoom === payload.liveKitRoom) {
    return;
  }

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
    isGroupCall: payload.isGroupCall,
    groupName: payload.groupName,
    groupPhotoUrl: payload.groupPhotoUrl,
    sentAtMs: payload.sentAtMs,
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
  if (
    payload.liveKitRoom &&
    (isCallCancelled(payload.liveKitRoom, payload.sentAtMs) ||
      isCallAnswered(payload.liveKitRoom, payload.sentAtMs))
  ) {
    return;
  }
  if (!navigationRef.isReady()) {
    pendingIncoming = payload;
    schedulePendingFlush();
    return;
  }
  clearPendingFlushTimer();
  openIncomingRoute(payload);
}
