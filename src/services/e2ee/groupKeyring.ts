/**
 * Group message keyring: one stable key for sending, many for reading.
 *
 * See `deriveStableGroupKey`. The returned key is a fresh Uint8Array each call
 * (same bytes) so React state holding it updates — and re-runs the retro-decrypt
 * sweep — whenever a newly learned roster adds a fallback.
 */
import {
  attachGroupKeyFallbacks,
  deriveGroupMessageKey,
  deriveStableGroupKey,
  maybeDecryptGroupContent,
} from './groupConversationCrypto';
import { readKnownRosters, rememberRoster } from './groupMemberCache';

export function buildGroupKeyring(
  groupId: string,
  extraRoster?: string[] | null,
): Uint8Array {
  if (extraRoster?.length) rememberRoster(groupId, extraRoster);
  const primary = new Uint8Array(deriveStableGroupKey(groupId));
  const fallbacks: Uint8Array[] = [];
  for (const roster of readKnownRosters(groupId)) {
    try {
      fallbacks.push(deriveGroupMessageKey(groupId, roster));
    } catch {
      /* skip malformed roster */
    }
  }
  // Last resort for history sealed under a roster this device never saw: the
  // sender's roster usually differs from ours by a member or two (joins/leaves).
  // Guess "current roster minus one/two members" — bounded so a big group
  // can't turn one failed message into thousands of key derivations.
  const current = readKnownRosters(groupId)[0];
  const lazy = () => {
    if (!current || current.length < 2 || current.length > 40) return [];
    const guesses: Uint8Array[] = [];
    const without = (skip: Set<number>) => current.filter((_, i) => !skip.has(i));
    for (let i = 0; i < current.length; i++) {
      guesses.push(deriveGroupMessageKey(groupId, without(new Set([i]))));
    }
    if (current.length <= 12) {
      for (let i = 0; i < current.length; i++) {
        for (let j = i + 1; j < current.length; j++) {
          guesses.push(deriveGroupMessageKey(groupId, without(new Set([i, j]))));
        }
      }
    }
    return guesses;
  };
  attachGroupKeyFallbacks(primary, fallbacks, lazy);
  return primary;
}

/** One-shot decrypt for contexts without React state (list preview, push). */
export function decryptGroupForChat(groupId: string, wire: string): string {
  return maybeDecryptGroupContent(wire, buildGroupKeyring(groupId));
}
