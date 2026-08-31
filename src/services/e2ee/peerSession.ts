/**
 * Resolves the peer key bundle a conversation needs, and decides which
 * encryption scheme a message should use.
 *
 * This is the seam between the new protocol and the old one, and the rules it
 * enforces matter more than the code:
 *
 *  1. If the peer has published keys, use HC2 (real E2EE).
 *  2. If they have NOT — their app predates this — fall back to the legacy
 *     scheme so the conversation still works. Refusing would break messaging
 *     for everyone whose peer has not updated, which is most people on day one.
 *  3. Never silently DOWNGRADE a conversation that has already used HC2. Once a
 *     session exists, a sudden "peer has no keys" is what a downgrade attack
 *     looks like, and it must not be honoured.
 *
 * Bundles are cached because fetching one CONSUMES a one-time prekey server
 * side. Fetching per message would burn the peer's entire prekey pool in a
 * single conversation.
 */
import { createMMKV, type MMKV } from 'react-native-mmkv';

import { fetchPeerBundles } from './keyDirectory';
import { hasSession } from './sessionStore';
import { trackPeerIdentity, type IdentityCheck } from './safetyNumber';
import type { PeerBundle } from './x3dh';
import { E2EE_V2_SENDING_ENABLED } from './secureMessaging';

let _store: MMKV | null = null;
function store(): MMKV {
  if (!_store) _store = createMMKV({ id: 'hopechat-e2ee-peerbundles-v1' });
  return _store;
}

/** Remembers that a conversation has gone encrypted, so it cannot go back. */
const upgradedKey = (conversationId: string) => `upgraded:${conversationId}`;

export function markConversationEncrypted(conversationId: string): void {
  try {
    store().set(upgradedKey(conversationId), '1');
  } catch {
    /* best-effort */
  }
}

export function conversationIsEncrypted(conversationId: string): boolean {
  try {
    return store().getString(upgradedKey(conversationId)) === '1';
  } catch {
    return false;
  }
}

const bundleKey = (peerUserId: string) => `bundle:${peerUserId}`;
const allBundlesKey = (peerUserId: string) => `bundles:${peerUserId}`;

/**
 * Every device the peer has published.
 *
 * A message must be encrypted once PER DEVICE — a ratchet session is between
 * two devices, so a session with the phone produces ciphertext the tablet
 * cannot open. Returning them all lets the caller fan out.
 */
export function cachedPeerBundles(peerUserId: string): PeerBundle[] {
  try {
    const raw = store().getString(allBundlesKey(peerUserId));
    const parsed = raw ? (JSON.parse(raw) as PeerBundle[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readCachedBundle(peerUserId: string): PeerBundle | null {
  try {
    const raw = store().getString(bundleKey(peerUserId));
    return raw ? (JSON.parse(raw) as PeerBundle) : null;
  } catch {
    return null;
  }
}

export type PeerKeyResult =
  | { mode: 'e2ee'; bundle: PeerBundle; identity: IdentityCheck }
  | { mode: 'legacy'; reason: 'no-keys' }
  | { mode: 'blocked'; reason: 'downgrade-refused' };

/**
 * Get the bundle for a peer, fetching one only when a session does not already
 * exist. `peerDeviceId` from a cached bundle is what keys the ratchet session.
 */
export async function resolvePeerKeys(
  token: string,
  conversationId: string,
  peerUserId: string,
): Promise<PeerKeyResult> {
  const cached = readCachedBundle(peerUserId);
  if (cached && hasSession(conversationId, cached.deviceId)) {
    // Session already running: no fetch, no prekey consumed.
    return { mode: 'e2ee', bundle: cached, identity: { status: 'unchanged' } };
  }

  const bundles = await fetchPeerBundles(token, peerUserId);
  if (bundles.length === 0) {
    if (conversationIsEncrypted(conversationId)) {
      // This conversation HAS been encrypted before. A peer suddenly having no
      // keys is indistinguishable from an attacker stripping them, so refuse
      // rather than quietly reverting to the weaker scheme.
      return { mode: 'blocked', reason: 'downgrade-refused' };
    }
    return { mode: 'legacy', reason: 'no-keys' };
  }

  // Keep EVERY device, not just the newest. A peer signed in on a phone and a
  // tablet must be able to read on both; encrypting only to the most recent one
  // leaves the other showing permanently undecryptable messages.
  try {
    store().set(allBundlesKey(peerUserId), JSON.stringify(bundles));
  } catch {
    /* best-effort */
  }
  const bundle = bundles[0]!;
  const identity = trackPeerIdentity(peerUserId, bundle.identityKey);

  try {
    store().set(bundleKey(peerUserId), JSON.stringify(bundle));
  } catch {
    /* best-effort */
  }
  // Only record the upgrade once we can actually PRODUCE HC2. Marking it while
  // sending is gated off would arm the downgrade refusal for a conversation
  // that never became encrypted, blocking sends for no reason.
  if (E2EE_V2_SENDING_ENABLED) markConversationEncrypted(conversationId);
  return { mode: 'e2ee', bundle, identity };
}

/** The device id a conversation's ratchet session is stored under. */
export function cachedPeerDeviceId(peerUserId: string): string | null {
  return readCachedBundle(peerUserId)?.deviceId ?? null;
}

export function clearPeerBundles(): void {
  try {
    store().clearAll();
  } catch {
    /* best-effort */
  }
}
