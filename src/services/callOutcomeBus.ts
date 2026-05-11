import { DeviceEventEmitter } from 'react-native';

export const CALL_OUTCOME_EVENT = 'hopechat:call_outcome_v1';

export type CallOutcomePayload = {
  conversationId: string;
  callKind: 'audio' | 'video';
  /**
   * outgoing_not_connected — you placed a call and nobody connected in time.
   * incoming_missed — you declined / missed an inbound ring (attributed to caller).
   */
  variant: 'outgoing_not_connected' | 'incoming_missed';
  peerUserId?: string;
  peerDisplayName?: string;
};

export function emitCallOutcome(payload: CallOutcomePayload): void {
  DeviceEventEmitter.emit(CALL_OUTCOME_EVENT, payload);
}

/** Single source for chat row + thread cache text (Inbox + ChatsContext). */
export function formatCallOutcomeLine(p: CallOutcomePayload): string {
  if (p.variant === 'outgoing_not_connected') {
    return p.callKind === 'video'
      ? '📹 Video call · No answer'
      : '📞 Voice call · No answer';
  }
  return p.callKind === 'video' ? '📹 Missed video call' : '📞 Missed voice call';
}
