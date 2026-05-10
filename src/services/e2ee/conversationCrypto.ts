/**
 * Hope Chat 1:1 conversation encryption (client-side only).
 * Wire format: HC1: + base64(nonce24 || xchacha ciphertext+tag).
 * Key: HKDF-SHA256 over sorted participant ids + conversation id (same key both peers).
 * Legacy plaintext: no HC1: prefix — decrypt is skipped, previews/messages unchanged.
 *
 * Upgrade path: replace with Signal/libsignal when you add server-side key exchange.
 */
import { xchacha20poly1305 } from '@noble/ciphers/chacha';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha2';
import { randomBytes } from '@noble/hashes/utils';

import { normalizeChatUserId } from '../../utils/chatUserId';

const WIRE_PREFIX = 'HC1:';
const te = new TextEncoder();
const td = new TextDecoder();

function sortParticipantIds(a: string, b: string): [string, string] {
  const na = normalizeChatUserId(a) || a;
  const nb = normalizeChatUserId(b) || b;
  return na < nb ? [na, nb] : [nb, na];
}

/** 32-byte symmetric key for this DM + conversation id. */
export function deriveConversationMessageKey(
  localUserId: string,
  peerUserId: string,
  conversationId: string,
): Uint8Array {
  const [x, y] = sortParticipantIds(localUserId, peerUserId);
  const ikm = sha256(te.encode(`hopechat-e2ee-v1|${x}|${y}|${conversationId}`));
  const salt = te.encode('hopechat-hkdf-salt-v1');
  const info = te.encode('hopechat-msg-v1');
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

export function encryptMessagePayload(plaintext: string, key: Uint8Array): string {
  const nonce = randomBytes(24);
  const cipher = xchacha20poly1305(key, nonce);
  const ct = cipher.encrypt(te.encode(plaintext));
  const combined = new Uint8Array(nonce.length + ct.length);
  combined.set(nonce, 0);
  combined.set(ct, nonce.length);
  return `${WIRE_PREFIX}${toBase64(combined)}`;
}

export function decryptMessagePayload(
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

/** Try decrypt; if not our envelope or failure, return original (legacy/plain). */
export function maybeDecryptContent(
  wire: string,
  key: Uint8Array | null | undefined,
): string {
  if (!key?.length) return wire;
  const d = decryptMessagePayload(wire, key);
  return d !== null ? d : wire;
}

export function isEncryptedEnvelope(content: string): boolean {
  return typeof content === 'string' && content.startsWith(WIRE_PREFIX);
}
