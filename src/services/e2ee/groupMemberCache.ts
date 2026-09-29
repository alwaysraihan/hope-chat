/**
 * Cached group membership, used only to re-derive the group message key.
 *
 * The group key is `HKDF(groupId + sorted member ids)`. Those ids arrive from
 * `fetchGroupInfo`, a network round-trip — so on every group open the thread
 * first rendered raw "HCG1:…" ciphertext and only flipped to plaintext once the
 * call landed. Worse, `shouldEncryptOutgoing` was false during that window, so
 * a message sent immediately after opening went out unencrypted.
 *
 * Caching the *member ids* (not the derived key) keeps no key material at rest
 * — derivation is a single sha256 + HKDF, cheap enough to redo synchronously on
 * mount — while removing the round-trip from the common path.
 */

import { createMMKV } from 'react-native-mmkv';

let _store: ReturnType<typeof createMMKV> | null = null;
function store() {
  if (!_store) _store = createMMKV({ id: 'hopechat-group-members-v1' });
  return _store;
}

function key(conversationId: string): string {
  return `members:${conversationId}`;
}

export function readCachedGroupMembers(
  conversationId: string,
): string[] | null {
  if (!conversationId) return null;
  try {
    const raw = store().getString(key(conversationId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const ids = parsed.filter((v): v is string => typeof v === 'string');
    return ids.length > 0 ? ids : null;
  } catch {
    return null;
  }
}

export function writeCachedGroupMembers(
  conversationId: string,
  memberIds: string[],
): void {
  if (!conversationId || memberIds.length === 0) return;
  try {
    store().set(key(conversationId), JSON.stringify(memberIds));
  } catch {
    /* best-effort */
  }
}

/** Order-insensitive comparison — the key derivation sorts ids anyway. */
export function sameMembers(a: string[] | null, b: string[] | null): boolean {
  if (!a || !b || a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}
