/**
 * Per-install identity for real end-to-end encryption.
 *
 * WHY THIS EXISTS
 * ---------------
 * The previous scheme derived message keys from the participants' user ids and
 * the conversation id:
 *
 *     ikm = sha256("hopechat-e2ee-v1|" + userA + "|" + userB + "|" + chatId)
 *
 * Every input there is public and known to the server, so the server could
 * derive the key and read every message. That is encryption in name only.
 *
 * Here the secret is a private key GENERATED ON THE DEVICE that is never
 * transmitted. Only public halves are published. The server can route
 * ciphertext and hand out public prekeys; it cannot read anything.
 *
 * KEY MATERIAL (X3DH, as used by Signal/WhatsApp)
 *  - identity      : long-term X25519 pair. Stable for the life of the install.
 *  - signing       : long-term Ed25519 pair, signs the signed prekey so a peer
 *                    can verify the server did not substitute its own.
 *  - signedPreKey  : medium-term X25519 pair, rotated periodically.
 *  - oneTimePreKeys: single-use X25519 pairs, so a session can be established
 *                    while the recipient is offline, with forward secrecy.
 *
 * STORAGE CAVEAT — READ THIS
 * --------------------------
 * Private keys live in MMKV, which is NOT hardware-backed. On a rooted or
 * compromised device they are readable. Signal/WhatsApp keep the equivalent in
 * the Android Keystore / iOS Keychain. Moving to `react-native-keychain` is a
 * native dependency and a rebuild; until then this protects against the server
 * and the network, but not against an attacker with the unlocked device.
 */
import { ed25519, x25519 } from '@noble/curves/ed25519.js';
import { randomBytes } from '@noble/hashes/utils';
import { createMMKV, type MMKV } from 'react-native-mmkv';

let _store: MMKV | null = null;
function store(): MMKV {
  if (!_store) _store = createMMKV({ id: 'hopechat-e2ee-identity-v1' });
  return _store;
}

const K_IDENTITY = 'identity_priv';
const K_SIGNING = 'signing_priv';
const K_SIGNED_PREKEY = 'signed_prekey';
const K_DEVICE_ID = 'device_id';
const K_ONE_TIME = 'one_time_prekeys';

export const ONE_TIME_PREKEY_BATCH = 100;

export function b64(u8: Uint8Array): string {
  let s = '';
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]!);
  return btoa(s);
}

export function unb64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function getOrCreatePrivate(key: string): Uint8Array {
  const existing = store().getString(key);
  if (existing) return unb64(existing);
  const priv = randomBytes(32);
  store().set(key, b64(priv));
  return priv;
}

/** Stable id for this install. Not a secret — it just names the key bundle. */
export function deviceId(): string {
  const existing = store().getString(K_DEVICE_ID);
  if (existing) return existing;
  const id = b64(randomBytes(16)).replace(/[^a-zA-Z0-9]/g, '').slice(0, 22);
  store().set(K_DEVICE_ID, id);
  return id;
}

export function identityPrivateKey(): Uint8Array {
  return getOrCreatePrivate(K_IDENTITY);
}

export function identityPublicKey(): Uint8Array {
  return x25519.getPublicKey(identityPrivateKey());
}

export function signingPrivateKey(): Uint8Array {
  return getOrCreatePrivate(K_SIGNING);
}

export function signingPublicKey(): Uint8Array {
  return ed25519.getPublicKey(signingPrivateKey());
}

export type SignedPreKey = { id: number; priv: string; pub: string; sig: string };

/**
 * Medium-term prekey, signed by the identity's Ed25519 key.
 *
 * The signature is what stops a malicious server handing a peer ITS OWN prekey
 * and silently sitting in the middle: the peer verifies the signature against
 * the identity key it already knows before using it.
 */
export function getOrCreateSignedPreKey(): SignedPreKey {
  const raw = store().getString(K_SIGNED_PREKEY);
  if (raw) {
    try {
      return JSON.parse(raw) as SignedPreKey;
    } catch {
      /* regenerate below */
    }
  }
  const priv = randomBytes(32);
  const pub = x25519.getPublicKey(priv);
  const sig = ed25519.sign(pub, signingPrivateKey());
  const spk: SignedPreKey = {
    id: Math.floor(Date.now() / 1000),
    priv: b64(priv),
    pub: b64(pub),
    sig: b64(sig),
  };
  store().set(K_SIGNED_PREKEY, JSON.stringify(spk));
  return spk;
}

export type OneTimePreKey = { id: number; priv: string; pub: string };

function readOneTime(): OneTimePreKey[] {
  try {
    const raw = store().getString(K_ONE_TIME);
    return raw ? (JSON.parse(raw) as OneTimePreKey[]) : [];
  } catch {
    return [];
  }
}

function writeOneTime(keys: OneTimePreKey[]): void {
  try {
    store().set(K_ONE_TIME, JSON.stringify(keys));
  } catch {
    /* best-effort */
  }
}

/** Generate a fresh batch to publish. Privates stay here; only pubs go up. */
export function generateOneTimePreKeys(count = ONE_TIME_PREKEY_BATCH): OneTimePreKey[] {
  const existing = readOneTime();
  const base = Math.floor(Date.now() / 1000);
  const made: OneTimePreKey[] = [];
  for (let i = 0; i < count; i++) {
    const priv = randomBytes(32);
    made.push({
      id: base + i,
      priv: b64(priv),
      pub: b64(x25519.getPublicKey(priv)),
    });
  }
  writeOneTime([...existing, ...made]);
  return made;
}

/** Find the private half of a one-time prekey a peer consumed. */
export function takeOneTimePreKey(id: number): Uint8Array | null {
  const all = readOneTime();
  const found = all.find(k => k.id === id);
  if (!found) return null;
  // Consume it: a one-time prekey used twice loses the forward secrecy it exists
  // to provide.
  writeOneTime(all.filter(k => k.id !== id));
  return unb64(found.priv);
}

export function remainingOneTimePreKeys(): number {
  return readOneTime().length;
}

/** Public bundle to publish to the server. Contains NO private material. */
export function publicBundle(): {
  deviceId: string;
  identityKey: string;
  signingKey: string;
  signedPreKeyId: number;
  signedPreKey: string;
  signedPreKeySig: string;
} {
  const spk = getOrCreateSignedPreKey();
  return {
    deviceId: deviceId(),
    identityKey: b64(identityPublicKey()),
    signingKey: b64(signingPublicKey()),
    signedPreKeyId: spk.id,
    signedPreKey: spk.pub,
    signedPreKeySig: spk.sig,
  };
}

/** Verify a peer's signed prekey against their identity. NEVER skip this. */
export function verifySignedPreKey(
  signedPreKeyB64: string,
  sigB64: string,
  signingKeyB64: string,
): boolean {
  try {
    return ed25519.verify(unb64(sigB64), unb64(signedPreKeyB64), unb64(signingKeyB64));
  } catch {
    return false;
  }
}
