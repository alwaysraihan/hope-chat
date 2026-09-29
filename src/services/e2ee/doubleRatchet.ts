/**
 * Double Ratchet — per-message key rotation, as used by Signal, WhatsApp and
 * Telegram's secret chats.
 *
 * X3DH establishes ONE shared secret. That alone is not enough: if it leaks,
 * every message in the conversation is readable. The ratchet turns that single
 * secret into a fresh key for every message, so:
 *
 *  - Forward secrecy: a stolen key cannot decrypt earlier messages.
 *  - Break-in recovery: once a new DH ratchet step happens, a past compromise
 *    stops being useful for future messages.
 *
 * TWO RATCHETS
 *  1. DH ratchet   — each side publishes a new X25519 public key with its
 *                    messages. When you see a new one from the peer, both root
 *                    and chain keys are re-derived. This is what heals a
 *                    compromise.
 *  2. Symmetric    — within a chain, each message advances the chain key by one
 *                    HMAC step, producing a one-time message key.
 *
 * PERFORMANCE (the reason Telegram feels instant)
 * -----------------------------------------------
 * A ratchet is directional and ordered: message N's key only exists after
 * advancing the chain N times. Re-deriving from scratch on every render would
 * be O(n) per message and would get slower as a conversation grows.
 *
 * So: decrypt ONCE, on receipt, and persist the plaintext locally. The UI then
 * reads plaintext and never touches crypto during render. `skippedKeys` below
 * exists for the same reason — out-of-order or dropped messages must not force
 * a re-walk of the chain.
 *
 * Each step is one HMAC-SHA256 (microseconds). The cost that matters is never
 * the crypto; it is re-doing work that should have been cached.
 */
import { xchacha20poly1305 } from '@noble/ciphers/chacha';
import { hkdf } from '@noble/hashes/hkdf';
import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha2';
import { randomBytes } from '@noble/hashes/utils';
import { x25519 } from '@noble/curves/ed25519.js';

import { b64, unb64 } from './identity';

const te = new TextEncoder();
const td = new TextDecoder();

/** Cap on retained out-of-order keys, so a malicious peer cannot exhaust memory. */
const MAX_SKIP = 1000;

export type RatchetState = {
  /** Root key — advanced only by a DH ratchet step. */
  rootKey: string;
  /** Our current DH pair. */
  dhPriv: string;
  dhPub: string;
  /** Peer's latest DH public key, if seen. */
  peerDhPub: string | null;
  /** Sending / receiving chain keys. */
  sendChain: string | null;
  recvChain: string | null;
  sendCount: number;
  recvCount: number;
  /** Messages sent in the previous sending chain — lets the peer skip cleanly. */
  prevSendCount: number;
  /** Keys for messages that arrived out of order: "peerDhPub:index" -> key. */
  skippedKeys: Record<string, string>;
};

export type RatchetHeader = {
  dh: string;
  n: number;
  pn: number;
};

function kdfRoot(rootKey: Uint8Array, dhOut: Uint8Array): [Uint8Array, Uint8Array] {
  const out = hkdf(sha256, dhOut, rootKey, te.encode('hopechat-ratchet-root'), 64);
  return [out.slice(0, 32), out.slice(32, 64)];
}

/**
 * Chain step. Constants 0x01/0x02 keep the message key and the next chain key
 * independent: knowing one must not reveal the other.
 */
function kdfChain(chainKey: Uint8Array): [Uint8Array, Uint8Array] {
  const messageKey = hmac(sha256, chainKey, new Uint8Array([0x01]));
  const nextChain = hmac(sha256, chainKey, new Uint8Array([0x02]));
  return [nextChain, messageKey];
}

/** Initiator: holds the shared secret and the peer's signed prekey. */
export function initSender(sharedSecret: Uint8Array, peerDhPub: Uint8Array): RatchetState {
  const dhPriv = randomBytes(32);
  const dhPub = x25519.getPublicKey(dhPriv);
  const [rootKey, sendChain] = kdfRoot(
    sharedSecret,
    x25519.getSharedSecret(dhPriv, peerDhPub),
  );
  return {
    rootKey: b64(rootKey),
    dhPriv: b64(dhPriv),
    dhPub: b64(dhPub),
    peerDhPub: b64(peerDhPub),
    sendChain: b64(sendChain),
    recvChain: null,
    sendCount: 0,
    recvCount: 0,
    prevSendCount: 0,
    skippedKeys: {},
  };
}

/** Responder: starts with its signed prekey pair as the DH pair, no chains yet. */
export function initReceiver(
  sharedSecret: Uint8Array,
  ownDhPriv: Uint8Array,
): RatchetState {
  return {
    rootKey: b64(sharedSecret),
    dhPriv: b64(ownDhPriv),
    dhPub: b64(x25519.getPublicKey(ownDhPriv)),
    peerDhPub: null,
    sendChain: null,
    recvChain: null,
    sendCount: 0,
    recvCount: 0,
    prevSendCount: 0,
    skippedKeys: {},
  };
}

export function ratchetEncrypt(
  state: RatchetState,
  plaintext: string,
): { state: RatchetState; header: RatchetHeader; body: string } | null {
  if (!state.sendChain) return null;
  const [nextChain, messageKey] = kdfChain(unb64(state.sendChain));
  const nonce = randomBytes(24);
  const ct = xchacha20poly1305(messageKey, nonce).encrypt(te.encode(plaintext));
  const packed = new Uint8Array(nonce.length + ct.length);
  packed.set(nonce, 0);
  packed.set(ct, nonce.length);

  return {
    state: {
      ...state,
      sendChain: b64(nextChain),
      sendCount: state.sendCount + 1,
    },
    header: { dh: state.dhPub, n: state.sendCount, pn: state.prevSendCount },
    body: b64(packed),
  };
}

/** Retain keys for messages we have not seen yet, so late arrivals still open. */
function skipMessageKeys(state: RatchetState, until: number): RatchetState {
  if (!state.recvChain || state.recvCount >= until) return state;
  if (until - state.recvCount > MAX_SKIP) return state;

  let chain = unb64(state.recvChain);
  const skipped = { ...state.skippedKeys };
  let n = state.recvCount;
  while (n < until) {
    const [next, mk] = kdfChain(chain);
    skipped[`${state.peerDhPub}:${n}`] = b64(mk);
    chain = next;
    n += 1;
  }
  return { ...state, recvChain: b64(chain), recvCount: n, skippedKeys: skipped };
}

/** Peer sent a new DH key: advance the root and open a fresh receiving chain. */
function dhRatchet(state: RatchetState, header: RatchetHeader): RatchetState {
  const withSkipped = skipMessageKeys(state, header.pn);
  const peerPub = unb64(header.dh);

  const [rootA, recvChain] = kdfRoot(
    unb64(withSkipped.rootKey),
    x25519.getSharedSecret(unb64(withSkipped.dhPriv), peerPub),
  );

  const newPriv = randomBytes(32);
  const [rootB, sendChain] = kdfRoot(rootA, x25519.getSharedSecret(newPriv, peerPub));

  return {
    ...withSkipped,
    rootKey: b64(rootB),
    dhPriv: b64(newPriv),
    dhPub: b64(x25519.getPublicKey(newPriv)),
    peerDhPub: header.dh,
    recvChain: b64(recvChain),
    sendChain: b64(sendChain),
    prevSendCount: withSkipped.sendCount,
    sendCount: 0,
    recvCount: 0,
  };
}

export function ratchetDecrypt(
  state: RatchetState,
  header: RatchetHeader,
  body: string,
): { state: RatchetState; plaintext: string } | null {
  try {
    // Out-of-order message we already kept a key for.
    const skipKey = `${header.dh}:${header.n}`;
    const stored = state.skippedKeys[skipKey];
    if (stored) {
      const packed = unb64(body);
      const pt = xchacha20poly1305(unb64(stored), packed.slice(0, 24)).decrypt(
        packed.slice(24),
      );
      const rest = { ...state.skippedKeys };
      delete rest[skipKey];
      return { state: { ...state, skippedKeys: rest }, plaintext: td.decode(pt) };
    }

    let next = state;
    if (header.dh !== state.peerDhPub) next = dhRatchet(state, header);
    next = skipMessageKeys(next, header.n);
    if (!next.recvChain) return null;

    const [nextChain, messageKey] = kdfChain(unb64(next.recvChain));
    const packed = unb64(body);
    const pt = xchacha20poly1305(messageKey, packed.slice(0, 24)).decrypt(
      packed.slice(24),
    );

    return {
      state: { ...next, recvChain: b64(nextChain), recvCount: next.recvCount + 1 },
      plaintext: td.decode(pt),
    };
  } catch {
    // Authentication failure: wrong key, tampering, or a replay. Never guess.
    return null;
  }
}
