/**
 * Safety numbers — the human-verifiable fingerprint of a conversation.
 *
 * WHY THIS IS NOT OPTIONAL
 * ------------------------
 * X3DH authenticates a peer against the identity key the SERVER handed you. If
 * the server is malicious or compromised it can hand you its own key instead,
 * sit in the middle, and every signature still verifies — because you are
 * verifying the attacker's key against the attacker's key.
 *
 * The only defence is comparing the fingerprint out of band: read it aloud, or
 * scan it in person. That single step is what turns "trust the server" into
 * "trust nobody". Without it the MITM protection is theoretical, which is why
 * Signal and WhatsApp both surface it.
 *
 * Equally important: a peer's identity key CHANGING mid-conversation is exactly
 * what a MITM looks like. It is also what a reinstall looks like, so it cannot
 * simply be an error — but it must be SHOWN, never swallowed.
 */
import { sha256 } from '@noble/hashes/sha2';

import { b64, identityPublicKey, unb64 } from './identity';
import { createMMKV, type MMKV } from 'react-native-mmkv';

let _store: MMKV | null = null;
function store(): MMKV {
  if (!_store) _store = createMMKV({ id: 'hopechat-e2ee-peers-v1' });
  return _store;
}

/**
 * 60-digit fingerprint over both identity keys, sorted so both sides compute
 * the same value. 5200 iterations of hashing follows Signal's construction: it
 * makes brute-forcing a key that produces a chosen fingerprint impractical.
 */
function fingerprintFor(key: Uint8Array, iterations = 5200): string {
  let digest = key;
  for (let i = 0; i < iterations; i++) {
    digest = sha256(digest);
  }
  // 30 digits per party: 6 groups of 5, from 5 bytes each.
  let out = '';
  for (let i = 0; i < 6; i++) {
    const chunk = digest.slice(i * 5, i * 5 + 5);
    let n = 0;
    for (const byte of chunk) n = n * 256 + byte;
    out += String(n % 100000).padStart(5, '0');
  }
  return out;
}

export function safetyNumber(peerIdentityKeyB64: string): string {
  try {
    const mine = identityPublicKey();
    const theirs = unb64(peerIdentityKeyB64);
    const [a, b] = b64(mine) < peerIdentityKeyB64 ? [mine, theirs] : [theirs, mine];
    const combined = fingerprintFor(a) + fingerprintFor(b);
    // Grouped in fives, the way Signal displays it — easier to read aloud.
    return (combined.match(/.{1,5}/g) ?? []).join(' ');
  } catch {
    return '';
  }
}

export type IdentityCheck =
  | { status: 'first-contact' }
  | { status: 'unchanged' }
  | { status: 'changed'; previousKey: string };

/**
 * Record and check a peer's identity key.
 *
 * A change returns 'changed' rather than throwing: the UI must tell the user
 * ("X's security code changed") and let them re-verify, because the innocent
 * explanation (reinstall) and the dangerous one (interception) are
 * indistinguishable from here. Silently accepting it would defeat the whole
 * mechanism.
 */
export function trackPeerIdentity(
  peerUserId: string,
  identityKeyB64: string,
): IdentityCheck {
  const key = `peer:${peerUserId}`;
  try {
    const known = store().getString(key);
    if (!known) {
      store().set(key, identityKeyB64);
      return { status: 'first-contact' };
    }
    if (known === identityKeyB64) return { status: 'unchanged' };
    store().set(key, identityKeyB64);
    return { status: 'changed', previousKey: known };
  } catch {
    return { status: 'first-contact' };
  }
}

export function knownPeerIdentity(peerUserId: string): string | null {
  try {
    return store().getString(`peer:${peerUserId}`) ?? null;
  } catch {
    return null;
  }
}

export function clearPeerIdentities(): void {
  try {
    store().clearAll();
  } catch {
    /* best-effort */
  }
}
