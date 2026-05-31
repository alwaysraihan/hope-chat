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

export function decryptGroupMessage(
  wire: string,
  key: Uint8Array,
): string | null {
  if (!wire.startsWith(WIRE_PREFIX)) return null;
  const raw = fromBase64(wire.slice(WIRE_PREFIX.length));
  if (!raw || raw.length < 24 + 16) return null;
  const nonce = raw.subarray(0, 24);
  const ciphertext = raw.subarray(24);
  try {
    const cipher = xchacha20poly1305(key, nonce);
    const plain = cipher.decrypt(ciphertext);
    return td.decode(plain);
  } catch {
    return null;
  }
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
