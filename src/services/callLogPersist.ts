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
  isGroup?: boolean,
): Promise<ExtendedMessage | null> {
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

  // Group chats require the v2 endpoint — v1 returns 403 for group conversation IDs.
  const res = await sendHopenityChatMessage(p.conversationId, wire, token, null, isGroup);
  if (!res) {
    return null;
  }
  return mapApiRowToCallLogMessage(res as Record<string, unknown>, line, localUser);
}
