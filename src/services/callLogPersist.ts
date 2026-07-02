import type { ExtendedMessage } from '../components/types/chat';
import { mapApiMessageToTimeline } from './chatMessagePreview';
import { deriveConversationMessageKey, encryptMessagePayload } from './e2ee/conversationCrypto';
import { isE2eeEnabled } from './chatPrefs';
import { sendHopenityChatMessage } from './chatService';
import { normalizeChatUserId } from '../utils/chatUserId';
import { extractMessageSenderId } from '../utils/extractMessageSender';

import type { CallOutcomePayload } from './callOutcomeBus';

function mapApiRowToCallLogMessage(
  raw: Record<string, unknown>,
  line: string,
  localUser: { _id?: unknown; name?: string },
): ExtendedMessage {
  const ackSender =
    extractMessageSenderId(raw) ||
    normalizeChatUserId(String(localUser._id ?? '')) ||
    String(localUser._id ?? '');
  const ackUid =
    ackSender !== '' ? normalizeChatUserId(ackSender) || ackSender : 'me';
  const ackName =
    (raw.sender as { name?: string } | undefined)?.name ??
    (typeof localUser.name === 'string' ? localUser.name : 'You');
  const parsed = mapApiMessageToTimeline(raw);
  return {
    _id: String(raw.id ?? `call_${Date.now()}`),
    text: line,
    createdAt: raw.createdAt ? new Date(String(raw.createdAt)) : new Date(),
    user: {
      _id: ackUid,
      name: typeof ackName === 'string' ? ackName : 'You',
    },
    messageKind: 'call_log',
    ...(parsed.delivery ? { delivery: parsed.delivery } : {}),
  };
}

/**
 * Persists a call-outcome line as a normal chat message (server) so history survives reloads.
 * Uses the same HC1 envelope as other DMs when E2EE is enabled.
 */
export async function persistCallOutcomeChatMessage(
  p: CallOutcomePayload,
  line: string,
  token: string,
  localUser: { _id?: unknown; name?: string },
  opts?: {
    isGroup?: boolean;
    /** Groups AND v2-native DMs (no conversationKey) must use the v2 endpoint. */
    useV2?: boolean;
  },
): Promise<ExtendedMessage | null> {
  const isGroup = !!opts?.isGroup;
  let wire = line;
  const peer = p.peerUserId?.trim();
  const loc =
    normalizeChatUserId(String(localUser._id ?? '')) || String(localUser._id ?? '');
  // Skip E2EE for group chats — groups don't use symmetric DM keys.
  if (!isGroup && isE2eeEnabled() && peer && loc && loc !== 'me') {
    try {
      const key = deriveConversationMessageKey(loc, normalizeChatUserId(peer) || peer, p.conversationId);
      wire = encryptMessagePayload(line, key);
    } catch {
      /* fall back to plaintext */
    }
  }

  // v1 rejects group / v2-native conversation IDs (403). When the conversation
  // summary wasn't loaded we can't know the generation, so retry on the other
  // version before giving up — otherwise the call log stays offline-only and
  // the chat never appears in either user's inbox.
  const useV2 = opts?.useV2 ?? isGroup;
  let res = await sendHopenityChatMessage(p.conversationId, wire, token, null, useV2);
  if (!res) {
    res = await sendHopenityChatMessage(p.conversationId, wire, token, null, !useV2);
  }
  if (!res) {
    return null;
  }
  return mapApiRowToCallLogMessage(res as Record<string, unknown>, line, localUser);
}
