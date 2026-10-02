/**
 * Pure message-list helpers for the chat thread (merge, tombstones, optimistic
 * echo matching). Kept free of React / native modules so they are unit-testable.
 */
import { normalizeChatUserId } from './chatUserId';
import type { ExtendedMessage } from '../components/types/chat';
import type { ThreadIntroPeer } from '../context/InboxContext';

export const INTRO_MESSAGE_ID = '__hopenity_thread_intro';

export function buildThreadIntroMessage(peer: ThreadIntroPeer): ExtendedMessage {
  const first = peer.name.split(/\s+/)[0] || peer.name;
  return {
    _id: INTRO_MESSAGE_ID,
    threadIntro: {
      peerName: peer.name,
      subtitle: peer.subtitle ?? "You're friends on Hopenity",
      avatarUrl: peer.avatarUrl ?? null,
    },
    text: peer.prompt ?? `Say hi to your new Hopenity friend, ${first}.`,
    createdAt: new Date(1),
    user: { _id: '__hopenity_intro', name: 'Hopenity' },
  };
}

export function stripIntro(descNewestFirst: ExtendedMessage[]): ExtendedMessage[] {
  return descNewestFirst.filter(m => m._id !== INTRO_MESSAGE_ID);
}

export function createdAtMs(t: unknown): number {
  return t instanceof Date
    ? t.getTime()
    : new Date(t as string | number).getTime();
}

/**
 * True when `server` (fresh from the API) is the echo of a still-pending
 * optimistic bubble: same sender, same visible content, within 2 minutes.
 * Content matching is required because the optimistic _id is client-generated
 * and the send ack that swaps it for the server id can lose the race against
 * the thread poll — matching by _id alone rendered every sent message twice.
 */
export function isServerEchoOfPending(
  pending: ExtendedMessage,
  server: ExtendedMessage,
): boolean {
  const pUid =
    normalizeChatUserId(pending.user?._id) || String(pending.user?._id ?? '');
  const sUid =
    normalizeChatUserId(server.user?._id) || String(server.user?._id ?? '');
  if (!pUid || !sUid) return false;
  const sameSender =
    pUid === sUid ||
    (/^\d+$/.test(pUid) && /^\d+$/.test(sUid) && Number(pUid) === Number(sUid));
  if (!sameSender) return false;
  const dt = Math.abs(createdAtMs(server.createdAt) - createdAtMs(pending.createdAt));
  if (!Number.isFinite(dt) || dt > 2 * 60 * 1000) return false;
  const pText = String(pending.text ?? '').trim();
  const sText = String(server.text ?? '').trim();
  if (pText && sText && pText === sText) return true;
  const pMediaUrl = pending.media?.remoteUri ?? pending.media?.url ?? '';
  const sMediaUrl = server.media?.remoteUri ?? server.media?.url ?? '';
  if (pMediaUrl && sMediaUrl && pMediaUrl === sMediaUrl) return true;
  // Media messages travel as a bare URL in `content`.
  if (pMediaUrl && sText && pMediaUrl === sText) return true;
  return false;
}

/**
 * Merge freshly fetched messages into `prev` (both ascending). Rows whose id we
 * already have are dropped; a server row that matches a still-pending optimistic
 * bubble REPLACES it in place instead of appearing next to it.
 * Returns null when nothing changed.
 */
export const DELETED_TEXT = 'This message was deleted';

export function reactionSig(r?: ExtendedMessage['reactions']): string {
  return (r ?? []).map(x => `${x.userId}:${x.emoji}`).sort().join('|');
}

export function mergeFetchedAsc(
  prev: ExtendedMessage[],
  fetchedAsc: ExtendedMessage[],
): ExtendedMessage[] | null {
  // The server is authoritative for edits, reactions and deletions made on the
  // OTHER side. This used to ignore every row already on screen, so a peer's
  // edit/reaction/delete never appeared until the chat was reopened.
  const serverById = new Map(fetchedAsc.map(m => [String(m._id), m]));
  let changed = false;
  const patched = prev.map(m => {
    if (m.pending || m.failed) return m;
    const srv = serverById.get(String(m._id));
    if (!srv) return m;
    const patch: Partial<ExtendedMessage> = {};
    if (srv.deleted && !m.deleted) {
      patch.deleted = true;
      patch.text = DELETED_TEXT;
      patch.media = undefined;
      patch.reactions = [];
    } else if (!srv.deleted) {
      if (
        srv.editedAt !== m.editedAt &&
        srv.text &&
        !String(srv.text).startsWith('🔒')
      ) {
        patch.text = srv.text;
        patch.editedAt = srv.editedAt;
      }
      // Only trust the server's list when it actually sent one.
      if (srv.reactions && reactionSig(srv.reactions) !== reactionSig(m.reactions)) {
        patch.reactions = srv.reactions;
      }
    }
    if (Object.keys(patch).length === 0) return m;
    changed = true;
    return { ...m, ...patch };
  });

  const existingIds = new Set(prev.map(m => String(m._id)));
  const fresh = fetchedAsc.filter(m => !existingIds.has(String(m._id)));
  if (fresh.length === 0) return changed ? patched : null;
  const next = [...patched];
  const appended: ExtendedMessage[] = [];
  for (const srv of fresh) {
    const i = next.findIndex(
      m => (m.pending || m.failed) && isServerEchoOfPending(m, srv),
    );
    if (i >= 0) next[i] = srv;
    else appended.push(srv);
  }
  if (appended.length === 0) return next;
  const combined = [...next, ...appended];
  combined.sort((a, b) => createdAtMs(a.createdAt) - createdAtMs(b.createdAt));
  return combined;
}

/** Gifted Chat is newest-first; intro is oldest timestamp so it appears at top visually. */
export function mergeIntroDesc(
  descNewestFirst: ExtendedMessage[],
  peer?: ThreadIntroPeer,
): ExtendedMessage[] {
  if (!peer?.name?.trim()) return descNewestFirst;
  const intro = buildThreadIntroMessage(peer);
  return [...descNewestFirst, intro];
}

