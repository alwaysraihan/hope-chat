/**
 * Call waiting — a second call arriving while one is already in progress.
 *
 * Previously the new call silently TORE DOWN the call in progress and jumped
 * straight to the ringing screen: the user was dropped from a live conversation
 * without being asked, and the person they were talking to was hung up on. The
 * only "choice" was to answer.
 *
 * Now the second call is surfaced as a banner over the active call with Accept
 * and Decline, the way every phone dialer does it. Nothing is torn down until
 * the user actually accepts.
 */
import { DeviceEventEmitter } from 'react-native';

import type { IncomingCallPayload } from './payload';

export const CALL_WAITING_EVENT = 'hopechat:call_waiting_v1';
export const CALL_WAITING_CLEARED_EVENT = 'hopechat:call_waiting_cleared_v1';

/** Offer a second incoming call to the user instead of force-switching. */
export function emitCallWaiting(payload: IncomingCallPayload): void {
  DeviceEventEmitter.emit(CALL_WAITING_EVENT, payload);
}

/**
 * Withdraw the offer — the second caller gave up, or the call was cancelled
 * before the user chose. Keyed on the room so a stale cancel for an older call
 * cannot dismiss a newer offer.
 */
export function emitCallWaitingCleared(liveKitRoom: string): void {
  DeviceEventEmitter.emit(CALL_WAITING_CLEARED_EVENT, { liveKitRoom });
}
