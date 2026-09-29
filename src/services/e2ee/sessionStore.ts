/**
 * Persistent ratchet sessions and decrypted-message cache.
 *
 * TWO STORES, AND WHY BOTH ARE REQUIRED
 * -------------------------------------
 * 1. SESSIONS — the Double Ratchet state per conversation. A ratchet is
 *    stateful: chain keys advance with every message. Lose the state and every
 *    future message from that peer is undecryptable, forever. It therefore has
 *    to survive app restarts, and it has to be written back after EVERY
 *    encrypt/decrypt, not at some convenient later point.
 *
 * 2. PLAINTEXT — decrypted message bodies, keyed by message id.
 *
 *    This is what makes the app feel like Telegram. Ratchet keys are
 *    directional and ordered: message N's key only exists after advancing the
 *    chain N times, so re-deriving during render would be O(n) per message and
 *    would get slower as a conversation grows. Decrypt ONCE on receipt, keep
 *    the plaintext, and let the UI read plaintext only. Rendering then never
 *    touches cryptography at all.
 *
 * STORAGE CAVEAT
 * MMKV is not hardware-backed, so the cached plaintext is only as private as
 * the device. That is the same trade WhatsApp makes with its local database —
 * the protection is against the SERVER and the network, which is what E2EE is
 * for. An attacker holding an unlocked device has already won.
 */
import { createMMKV, type MMKV } from 'react-native-mmkv';

import type { RatchetState } from './doubleRatchet';

let _sessions: MMKV | null = null;
let _plain: MMKV | null = null;

function sessions(): MMKV {
  if (!_sessions) _sessions = createMMKV({ id: 'hopechat-e2ee-sessions-v1' });
  return _sessions;
}

function plaintext(): MMKV {
  if (!_plain) _plain = createMMKV({ id: 'hopechat-e2ee-plaintext-v1' });
  return _plain;
}

// ── Ratchet sessions ────────────────────────────────────────────────────────

const sessionKey = (conversationId: string, peerDeviceId: string) =>
  `s:${conversationId}:${peerDeviceId}`;

export function loadSession(
  conversationId: string,
  peerDeviceId: string,
): RatchetState | null {
  try {
    const raw = sessions().getString(sessionKey(conversationId, peerDeviceId));
    return raw ? (JSON.parse(raw) as RatchetState) : null;
  } catch {
    return null;
  }
}

export function saveSession(
  conversationId: string,
  peerDeviceId: string,
  state: RatchetState,
): void {
  try {
    sessions().set(sessionKey(conversationId, peerDeviceId), JSON.stringify(state));
  } catch {
    // A failed write means the next message cannot be decrypted. Loud, because
    // silently continuing produces a session that diverges from the peer's.
    console.warn('[e2ee] FAILED to persist ratchet session — session may desync');
  }
}

export function hasSession(conversationId: string, peerDeviceId: string): boolean {
  return loadSession(conversationId, peerDeviceId) != null;
}

/** Forget a session. Used when a peer's identity key changes (see safetyNumber). */
export function dropSession(conversationId: string, peerDeviceId: string): void {
  try {
    sessions().set(sessionKey(conversationId, peerDeviceId), '');
  } catch {
    /* best-effort */
  }
}

// ── Decrypted plaintext cache ───────────────────────────────────────────────

const plainKey = (messageId: string) => `p:${messageId}`;

export function cachePlaintext(messageId: string, text: string): void {
  if (!messageId) return;
  try {
    plaintext().set(plainKey(messageId), text);
  } catch {
    /* the message still renders this session; only the cache is lost */
  }
}

export function readPlaintext(messageId: string): string | null {
  if (!messageId) return null;
  try {
    const v = plaintext().getString(plainKey(messageId));
    return v && v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

/**
 * Wipe both stores. MUST run on logout: leaving decrypted message bodies and
 * live ratchet sessions on a shared device would undo the point of encrypting
 * them in the first place.
 */
export function clearAllE2eeData(): void {
  try {
    sessions().clearAll();
  } catch {
    /* best-effort */
  }
  try {
    plaintext().clearAll();
  } catch {
    /* best-effort */
  }
}
