/**
 * X3DH — the key agreement Signal, WhatsApp and Telegram's secret chats use to
 * establish a shared secret with someone who may be offline.
 *
 * The initiator combines four (or three) Diffie–Hellman results:
 *
 *   DH1 = DH(identityA,  signedPreKeyB)   binds the sender's identity
 *   DH2 = DH(ephemeralA, identityB)       binds the recipient's identity
 *   DH3 = DH(ephemeralA, signedPreKeyB)   the medium-term secret
 *   DH4 = DH(ephemeralA, oneTimePreKeyB)  optional, adds forward secrecy
 *
 *   SK  = HKDF(DH1 || DH2 || DH3 || DH4)
 *
 * Why all four: DH1+DH2 give mutual authentication (neither side can be
 * impersonated without their private identity key), DH3 gives secrecy against
 * an attacker who later steals an identity key, and DH4 means compromising the
 * signed prekey does not expose sessions that used a one-time key.
 *
 * The server can hand out the public bundle and route the ciphertext, but never
 * holds a private key, so it can never compute SK.
 */
import { x25519 } from '@noble/curves/ed25519.js';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha2';
import { randomBytes } from '@noble/hashes/utils';

import {
  b64,
  identityPrivateKey,
  getOrCreateSignedPreKey,
  takeOneTimePreKey,
  unb64,
  verifySignedPreKey,
} from './identity';

export type PeerBundle = {
  deviceId: string;
  identityKey: string;
  signingKey: string;
  signedPreKeyId: number;
  signedPreKey: string;
  signedPreKeySig: string;
  oneTimePreKeyId?: number | null;
  oneTimePreKey?: string | null;
};

/** What the initiator must send so the responder can derive the same secret. */
export type InitialMessageHeader = {
  identityKey: string;
  ephemeralKey: string;
  signedPreKeyId: number;
  oneTimePreKeyId?: number | null;
  deviceId: string;
};

function kdf(parts: Uint8Array[]): Uint8Array {
  // A 32-byte 0xFF prefix is the X3DH domain separator; it stops the input to
  // HKDF being confusable with a raw DH output.
  const prefix = new Uint8Array(32).fill(0xff);
  const total = parts.reduce((n, p) => n + p.length, prefix.length);
  const ikm = new Uint8Array(total);
  ikm.set(prefix, 0);
  let off = prefix.length;
  for (const p of parts) {
    ikm.set(p, off);
    off += p.length;
  }
  return hkdf(sha256, ikm, new TextEncoder().encode('hopechat-x3dh-v2'), new TextEncoder().encode('session'), 32);
}

/**
 * Initiator side. Returns the shared secret and the header to attach to the
 * first message.
 *
 * Returns null if the peer's signed prekey fails signature verification —
 * that is the check that defeats a server substituting its own key, so a
 * failure must abort rather than fall back to something weaker.
 */
export function initiateSession(
  peer: PeerBundle,
  selfDeviceId: string,
): { secret: Uint8Array; header: InitialMessageHeader } | null {
  if (!verifySignedPreKey(peer.signedPreKey, peer.signedPreKeySig, peer.signingKey)) {
    return null;
  }

  const idPriv = identityPrivateKey();
  const ephPriv = randomBytes(32);
  const ephPub = x25519.getPublicKey(ephPriv);

  const peerId = unb64(peer.identityKey);
  const peerSpk = unb64(peer.signedPreKey);

  const parts = [
    x25519.getSharedSecret(idPriv, peerSpk),
    x25519.getSharedSecret(ephPriv, peerId),
    x25519.getSharedSecret(ephPriv, peerSpk),
  ];
  if (peer.oneTimePreKey) {
    parts.push(x25519.getSharedSecret(ephPriv, unb64(peer.oneTimePreKey)));
  }

  return {
    secret: kdf(parts),
    header: {
      identityKey: b64(x25519.getPublicKey(idPriv)),
      ephemeralKey: b64(ephPub),
      signedPreKeyId: peer.signedPreKeyId,
      oneTimePreKeyId: peer.oneTimePreKeyId ?? null,
      deviceId: selfDeviceId,
    },
  };
}

/**
 * Responder side. Recomputes the same secret from the header the initiator sent.
 * The DH pairs are mirrored — same operations, opposite private keys.
 */
export function acceptSession(header: InitialMessageHeader): Uint8Array | null {
  try {
    const idPriv = identityPrivateKey();
    const spk = getOrCreateSignedPreKey();
    if (header.signedPreKeyId !== spk.id) {
      // Prekey has rotated since the sender fetched the bundle. Real clients
      // keep the previous signed prekey around for a grace period; we cannot
      // decrypt without it, so fail loudly rather than produce garbage.
      return null;
    }
    const spkPriv = unb64(spk.priv);
    const peerId = unb64(header.identityKey);
    const peerEph = unb64(header.ephemeralKey);

    const parts = [
      x25519.getSharedSecret(spkPriv, peerId),
      x25519.getSharedSecret(idPriv, peerEph),
      x25519.getSharedSecret(spkPriv, peerEph),
    ];
    if (header.oneTimePreKeyId != null) {
      const otp = takeOneTimePreKey(header.oneTimePreKeyId);
      if (!otp) return null;
      parts.push(x25519.getSharedSecret(otp, peerEph));
    }
    return kdf(parts);
  } catch {
    return null;
  }
}
