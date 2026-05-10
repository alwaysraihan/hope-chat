import { StackActions } from '@react-navigation/native';

import { navigationRef } from '../../navigation/navigationRef';
import type { IncomingCallPayload } from './payload';

let pendingIncoming: IncomingCallPayload | null = null;

export function consumePendingIncomingCall(): void {
  if (!navigationRef.isReady() || !pendingIncoming) return;
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
    }),
  );
}

export function navigateIncomingCall(payload: IncomingCallPayload): void {
  if (!navigationRef.isReady()) {
    pendingIncoming = payload;
    return;
  }
  openIncomingRoute(payload);
}
