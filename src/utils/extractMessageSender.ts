/**
 * Resolve sender id + direction hints from Hopenity / generic chat API shapes.
 */
import { normalizeChatUserId } from './chatUserId';

type Dict = Record<string, unknown>;

function pick(d: Dict | undefined | null, ...keys: string[]): unknown {
  if (!d) return undefined;
  for (const k of keys) {
    if (k in d && d[k] != null && d[k] !== '') return d[k];
  }
  return undefined;
}

/** Best-effort sender id from a message row (snake_case + camelCase + nested sender). */
export function extractMessageSenderId(raw: Dict): string {
  const sender = pick(raw, 'sender') as Dict | undefined;
  const from = pick(raw, 'from') as Dict | undefined;
  const user = pick(raw, 'user') as Dict | undefined;

  const cand =
    pick(raw, 'senderId', 'sender_id', 'userId', 'user_id') ??
    pick(raw, 'fromUserId', 'from_user_id', 'from_userId') ??
    pick(raw, 'authorId', 'author_id', 'createdByUserId', 'created_by_user_id') ??
    pick(raw, 'memberId', 'senderUserId', 'sender_user_id') ??
    pick(sender, 'user_id', 'userId', 'id', '_id') ??
    pick(sender, 'user') ??
    pick(from, 'id', '_id', 'user_id', 'userId') ??
    pick(user, 'id', '_id', 'user_id', 'userId') ??
    pick(raw, 'senderUser', 'sender_user');

  if (cand === undefined || cand === null) return '';

  if (typeof cand === 'object' && cand !== null) {
    const o = cand as Dict;
    const inner =
      pick(o, 'id', '_id', 'user_id', 'userId') ??
      pick(o, 'user', 'userId');
    if (inner != null) return String(inner).trim();
  }

  return String(cand).trim();
}

/** API hints: outgoing vs incoming (when sender id alone is ambiguous). */
export function extractOutgoingHint(raw: Dict): boolean | undefined {
  const v =
    pick(raw, 'isOutgoing', 'is_outgoing', 'outgoing', 'isSender', 'is_sender') ??
    pick(raw, 'fromMe', 'from_me', 'isOwn', 'is_own');
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    const s = v.toLowerCase();
    if (
      s === 'out' ||
      s === 'outgoing' ||
      s === 'sent' ||
      s === 'true' ||
      s === '1'
    ) {
      return true;
    }
    if (s === 'in' || s === 'incoming' || s === 'false' || s === '0') {
      return false;
    }
  }
  if (typeof v === 'number') return v !== 0;
  const dir = pick(raw, 'direction', 'messageDirection', 'message_direction');
  if (typeof dir === 'string') {
    const d = dir.toLowerCase();
    if (d === 'out' || d === 'outgoing' || d === 'sent') return true;
    if (d === 'in' || d === 'incoming' || d === 'received') return false;
  }
  return undefined;
}
