/**
 * LiveKit room names must match across clients. hopechat-web uses:
 * `[a, b].sort().join('-room-')` for 1:1 calls (see hopechat-web/src/App.tsx getRoomId).
 */
import { normalizeChatUserId } from './chatUserId';

export function derivePairwiseLiveKitRoom(
  localUserId: string,
  peerUserId: string,
): string {
  const a = normalizeChatUserId(localUserId);
  const b = normalizeChatUserId(peerUserId);
  const sorted = [a, b].sort();
  return `${sorted[0]}-room-${sorted[1]}`;
}

export function resolveLiveKitRoomName(params: {
  /** From navigation / push — takes precedence when set (server agreed room). */
  explicitRoom?: string | null;
  conversationId: string;
  peerUserId?: string | null;
  localUserId?: string | null;
  isGroup?: boolean;
}): string {
  const explicit = params.explicitRoom?.trim();
  if (explicit) {
    return explicit;
  }
  if (params.isGroup) {
    return `call_${params.conversationId}`;
  }
  const local = normalizeChatUserId(params.localUserId);
  const peer = normalizeChatUserId(params.peerUserId);
  if (
    local &&
    peer &&
    local !== 'me' &&
    local !== peer
  ) {
    return derivePairwiseLiveKitRoom(local, peer);
  }
  return `call_${params.conversationId}`;
}
