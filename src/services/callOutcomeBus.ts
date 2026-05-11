import { DeviceEventEmitter } from 'react-native';

import type { ExtendedMessage } from '../components/types/chat';

export const CALL_OUTCOME_EVENT = 'hopechat:call_outcome_v1';

/** After server persist (or offline fallback) — Inbox appends this row when the thread is open. */
export const CALL_OUTCOME_APPLIED_EVENT = 'hopechat:call_outcome_applied_v1';

export type CallOutcomeAppliedPayload = {
  conversationId: string;
  message: ExtendedMessage;
};

export type CallOutcomePayload = {
  conversationId: string;
  callKind: 'audio' | 'video';
  /**
   * outgoing_not_connected — you placed a call and nobody connected in time.
   * incoming_missed — you declined / missed an inbound ring (attributed to caller).
   * call_completed — outbound call where the peer joined; log duration to chat (outgoing only).
   */
  variant: 'outgoing_not_connected' | 'incoming_missed' | 'call_completed';
  peerUserId?: string;
  peerDisplayName?: string;
  /** Seconds on call with ≥1 remote (only for `call_completed`). */
  durationSeconds?: number;
};

export function emitCallOutcome(payload: CallOutcomePayload): void {
  DeviceEventEmitter.emit(CALL_OUTCOME_EVENT, payload);
}

export function emitCallOutcomeApplied(payload: CallOutcomeAppliedPayload): void {
  DeviceEventEmitter.emit(CALL_OUTCOME_APPLIED_EVENT, payload);
}

function formatDurationForCallLine(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

/** Single source for chat row + thread cache text (Inbox + ChatsContext). */
export function formatCallOutcomeLine(p: CallOutcomePayload): string {
  if (p.variant === 'call_completed') {
    const clock = formatDurationForCallLine(p.durationSeconds ?? 0);
    return p.callKind === 'video'
      ? `📹 Video call · ${clock}`
      : `📞 Voice call · ${clock}`;
  }
  if (p.variant === 'outgoing_not_connected') {
    return p.callKind === 'video'
      ? '📹 Video call · No answer'
      : '📞 Voice call · No answer';
  }
  return p.callKind === 'video' ? '📹 Missed video call' : '📞 Missed voice call';
}
