/**
 * Live status for the in-app "return to call" banner (WhatsApp-style bar
 * pinned above the navigator while a call is active but minimized).
 *
 * activeCallRegistry.ts is an imperative snapshot — nothing outside the call
 * screen is notified when status changes. This bus is the missing reactive
 * piece: the call screens emit on every connection-state change, and
 * CallStatusBanner (mounted once in App.tsx) subscribes and renders.
 */
import { DeviceEventEmitter } from 'react-native';
import type { ActiveCallKind } from './activeCallRegistry';

export const ACTIVE_CALL_STATUS_EVENT = 'hopechat:active_call_status_v1';
export const ACTIVE_CALL_ENDED_EVENT = 'hopechat:active_call_ended_v1';

export type ActiveCallStatus =
  | 'connecting'
  | 'ringing'
  | 'connected'
  | 'reconnecting';

export type ActiveCallStatusPayload = {
  liveKitRoom: string;
  kind: ActiveCallKind;
  status: ActiveCallStatus;
  peerName: string;
  peerAvatarUrl?: string | null;
  /** Set once, the first moment a remote participant is actually connected. */
  connectedAtMs?: number;
};

export function emitActiveCallStatus(payload: ActiveCallStatusPayload): void {
  DeviceEventEmitter.emit(ACTIVE_CALL_STATUS_EVENT, payload);
}

/** The call screen unmounted / the room disconnected — hide the banner. */
export function emitActiveCallEnded(liveKitRoom: string): void {
  DeviceEventEmitter.emit(ACTIVE_CALL_ENDED_EVENT, { liveKitRoom });
}
