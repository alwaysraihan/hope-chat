/**
 * Decrypt a push notification's body ON THE DEVICE.
 *
 * The server forwards the encrypted envelope (`cipher`) and a neutral
 * placeholder ("🔒 New message") because it genuinely cannot read the message —
 * that is what end-to-end encryption means. But the DEVICE holds the key, so it
 * can show the real text in the banner. This is exactly how WhatsApp and
 * Telegram display plaintext notifications without the server ever seeing
 * plaintext.
 *
 * Everything here must work in the headless notification context: no React, no
 * network, and only storage that is readable from a background JS context.
 *  - DM keys derive from the two user ids + conversation id — purely local.
 *  - Group keys derive from the cached member list in MMKV, which ChatsContext
 *    warms for every visible group when the chat list loads.
 *
 * Fails closed: any missing piece returns null and the caller keeps the
 * server's placeholder. A wrong or partial decrypt must never be shown.
 */
import { store } from '../../redux/store';
import {
  deriveConversationMessageKey,
  maybeDecryptContent,
} from '../e2ee/conversationCrypto';
import {
  deriveGroupMessageKey,
  maybeDecryptGroupContent,
} from '../e2ee/groupConversationCrypto';
import { readCachedGroupMembers } from '../e2ee/groupMemberCache';
import { readPlaintext } from '../e2ee/sessionStore';

const DM_PREFIX = 'HC1:';
const GROUP_PREFIX = 'HCG1:';

export function decryptNotificationBody(
  data: Record<string, string>,
): string | null {
  const cipher = String(data.cipher ?? '').trim();
  if (!cipher) return null;

  const chatId = String(data.chatId ?? data.chat_id ?? '').trim();
  if (!chatId) return null;

  try {
    // HC2 — the real E2EE format. The ratchet is deliberately NOT run here: its
    // keys are single-use and ordered, so decrypting in the notification
    // context would consume a key the chat thread still needs and desync the
    // session. If the thread has already decrypted this message the plaintext
    // cache has it; otherwise the placeholder stands until the app opens.
    if (cipher.startsWith('HC2:')) {
      const messageId = String(data.messageId ?? data.message_id ?? '').trim();
      return messageId ? readPlaintext(messageId) : null;
    }

    if (cipher.startsWith(GROUP_PREFIX)) {
      const members = readCachedGroupMembers(chatId);
      if (!members?.length) return null;
      const key = deriveGroupMessageKey(chatId, members);
      const out = maybeDecryptGroupContent(cipher, key);
      return out && out !== cipher ? out : null;
    }

    if (cipher.startsWith(DM_PREFIX)) {
      const localUserId = String(
        store.getState().auth.profile?.userId ?? '',
      ).trim();
      const peerUserId = String(
        data.sender_user_id ?? data.senderUserId ?? '',
      ).trim();
      if (!localUserId || !peerUserId) return null;
      const key = deriveConversationMessageKey(localUserId, peerUserId, chatId);
      const out = maybeDecryptContent(cipher, key);
      return out && out !== cipher ? out : null;
    }
  } catch {
    // Key derivation or decryption failed — keep the placeholder.
  }
  return null;
}
