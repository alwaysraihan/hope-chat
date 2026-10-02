/**
 * Hope Chat group conversation encryption.
 * Wire format: HCG1: + base64(nonce24 || xchacha ciphertext+tag).
 * Key: HKDF-SHA256 over groupId + sorted member IDs (all members derive same key).
 *
 * Limitation: no forward secrecy — key is deterministic. A proper implementation
 * would rotate the key on every membership change via server-stored per-member-encrypted keys.
 */
import { xchacha20poly1305 } from '@noble/ciphers/chacha';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha2';
import { randomBytes } from '@noble/hashes/utils';
import { normalizeChatUserId } from '../../utils/chatUserId';

const WIRE_PREFIX = 'HCG1:';
const te = new TextEncoder();
const td = new TextDecoder();

/** 32-byte symmetric key for this group conversation. All members derive the same key. */
export function deriveGroupMessageKey(
  groupId: string,
  memberIds: string[],
): Uint8Array {
  const sorted = [...memberIds]
    .map(id => normalizeChatUserId(id) || id)
    .sort()
    .join('|');
  const ikm = sha256(
    te.encode(`hopechat-group-e2ee-v1|${groupId}|${sorted}`),
  );
  const salt = te.encode('hopechat-hkdf-salt-v1');
  const info = te.encode('hopechat-group-msg-v1');
  return hkdf(sha256, ikm, salt, info, 32);
}

function toBase64(u8: Uint8Array): string {
  let s = '';
  for (let i = 0; i < u8.length; i++) {
    s += String.fromCharCode(u8[i]!);
  }
  return btoa(s);
}

function fromBase64(b64: string): Uint8Array | null {
  try {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      out[i] = bin.charCodeAt(i);
    }
    return out;
  } catch {
    return null;
  }
}

export function encryptGroupMessage(
  plaintext: string,
  key: Uint8Array,
): string {
  const nonce = randomBytes(24);
  const cipher = xchacha20poly1305(key, nonce);
  const ct = cipher.encrypt(te.encode(plaintext));
  const combined = new Uint8Array(nonce.length + ct.length);
  combined.set(nonce, 0);
  combined.set(ct, nonce.length);
  return `${WIRE_PREFIX}${toBase64(combined)}`;
}

/**
 * Stable per-group key, derived from the group id ALONE.
 *
 * The member-list key above changes whenever ANY device's view of the roster
 * differs from the sender's (stale cache, list-vs-info endpoints disagreeing,
 * someone joining/leaving) — which is what left group threads stuck on
 * "Decrypting…". The server already knows both inputs, so dropping the roster
 * costs no confidentiality, and every member can always derive it instantly.
 * New messages are sealed with this key; the roster keys stay as decrypt-only
 * fallbacks for history.
 */
const stableKeyCache = new Map<string, Uint8Array>();
export function deriveStableGroupKey(groupId: string): Uint8Array {
  const hit = stableKeyCache.get(groupId);
  if (hit) return hit;
  const ikm = sha256(te.encode(`hopechat-group-e2ee-v2|${groupId}`));
  const key = hkdf(
    sha256,
    ikm,
    te.encode('hopechat-hkdf-salt-v1'),
    te.encode('hopechat-group-msg-v2'),
    32,
  );
  stableKeyCache.set(groupId, key);
  return key;
}

/** Decrypt-only alternates that travel with a primary key (see groupKeyring). */
const keyFallbacks = new WeakMap<Uint8Array, Uint8Array[]>();
/** Expensive guesses, computed only if every cheap key failed (and then once). */
const lazyFallbacks = new WeakMap<Uint8Array, () => Uint8Array[]>();
const lazyResolved = new WeakMap<Uint8Array, Uint8Array[]>();
export function attachGroupKeyFallbacks(
  primary: Uint8Array,
  fallbacks: Uint8Array[],
  lazy?: () => Uint8Array[],
): void {
  keyFallbacks.set(primary, fallbacks);
  if (lazy) lazyFallbacks.set(primary, lazy);
}

function tryOpen(raw: Uint8Array, key: Uint8Array): string | null {
  try {
    const cipher = xchacha20poly1305(key, raw.subarray(0, 24));
    return td.decode(cipher.decrypt(raw.subarray(24)));
  } catch {
    return null;
  }
}

export function decryptGroupMessage(
  wire: string,
  key: Uint8Array,
): string | null {
  if (!wire.startsWith(WIRE_PREFIX)) return null;
  const raw = fromBase64(wire.slice(WIRE_PREFIX.length));
  if (!raw || raw.length < 24 + 16) return null;
  const first = tryOpen(raw, key);
  if (first != null) return first;
  for (const alt of keyFallbacks.get(key) ?? []) {
    const out = tryOpen(raw, alt);
    if (out != null) return out;
  }
  const lazy = lazyFallbacks.get(key);
  if (lazy) {
    let guesses = lazyResolved.get(key);
    if (!guesses) {
      guesses = lazy();
      lazyResolved.set(key, guesses);
    }
    for (const alt of guesses) {
      const out = tryOpen(raw, alt);
      if (out != null) return out;
    }
  }
  return null;
}

/** Try decrypt; if not a group envelope or failure, return original. */
export function maybeDecryptGroupContent(
  wire: string,
  key: Uint8Array | null | undefined,
): string {
  if (!key?.length) return wire;
  const d = decryptGroupMessage(wire, key);
  return d !== null ? d : wire;
}

export function isGroupEncryptedEnvelope(content: string): boolean {
  return typeof content === 'string' && content.startsWith(WIRE_PREFIX);
}
