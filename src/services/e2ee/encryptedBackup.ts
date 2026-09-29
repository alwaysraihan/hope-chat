/**
 * End-to-end encrypted history backup — "reinstall without losing your chats".
 *
 * THE TRADE-OFF, STATED PLAINLY
 * -----------------------------
 * Telegram's cloud chats never lose history because Telegram's SERVERS hold the
 * keys — those chats are encrypted in transit and at rest, but Telegram can read
 * them. Only Telegram's Secret Chats are end-to-end, and those DO lose history
 * on reinstall, because nobody but the two devices can decrypt them.
 *
 * You cannot have both properties from the same mechanism. What you can have is
 * WhatsApp's answer, which is what this implements:
 *
 *   The DEVICE encrypts its own history with a key derived from a passphrase
 *   only the user knows, and uploads an opaque blob. The server stores and
 *   returns it, and can never open it. On a new install the user enters the
 *   passphrase and gets everything back.
 *
 * So: no data loss, and the server still cannot read anything.
 *
 * The cost is honest and must be surfaced in the UI: LOSE THE PASSPHRASE AND THE
 * BACKUP IS GONE. There is deliberately no reset, because a reset the server
 * could perform would mean the server could decrypt.
 *
 * KDF: Argon2id, the current standard for passphrase hashing, chosen over
 * PBKDF2 because it is memory-hard — a GPU farm cannot brute-force a weak
 * passphrase nearly as cheaply.
 */
import { argon2id } from '@noble/hashes/argon2';
import { xchacha20poly1305 } from '@noble/ciphers/chacha';
import { randomBytes } from '@noble/hashes/utils';

import { API_BASE_URL } from '../../config/env';
import { b64, unb64 } from './identity';

const te = new TextEncoder();
const td = new TextDecoder();

/**
 * Argon2id parameters. 64 MiB / 3 passes is a common mobile-friendly setting:
 * roughly a second on a mid-range phone, which is unnoticeable once but
 * expensive enough to make offline guessing painful.
 */
export const KDF_PARAMS = { m: 65536, t: 3, p: 1, v: 1 } as const;

export type BackupPayload = {
  /** messageId -> plaintext */
  messages: Record<string, string>;
  /** Long-term identity material, so restored sessions can continue. */
  identity?: Record<string, string>;
  createdAt: number;
};

function deriveBackupKey(passphrase: string, salt: Uint8Array): Uint8Array {
  return argon2id(te.encode(passphrase), salt, {
    m: KDF_PARAMS.m,
    t: KDF_PARAMS.t,
    p: KDF_PARAMS.p,
    dkLen: 32,
  });
}

export function encryptBackup(
  payload: BackupPayload,
  passphrase: string,
): { blob: string; salt: string; params: string } {
  const salt = randomBytes(16);
  const key = deriveBackupKey(passphrase, salt);
  const nonce = randomBytes(24);
  const ct = xchacha20poly1305(key, nonce).encrypt(te.encode(JSON.stringify(payload)));
  const packed = new Uint8Array(nonce.length + ct.length);
  packed.set(nonce, 0);
  packed.set(ct, nonce.length);
  return {
    blob: b64(packed),
    salt: b64(salt),
    params: JSON.stringify(KDF_PARAMS),
  };
}

/**
 * Returns null on a wrong passphrase — the AEAD tag fails, which is the only
 * signal there is. Never guess or partially accept: a corrupted restore is
 * worse than a failed one.
 */
export function decryptBackup(
  blob: string,
  saltB64: string,
  paramsJson: string,
  passphrase: string,
): BackupPayload | null {
  try {
    const params = JSON.parse(paramsJson) as typeof KDF_PARAMS;
    const salt = unb64(saltB64);
    const key = argon2id(te.encode(passphrase), salt, {
      m: params.m,
      t: params.t,
      p: params.p,
      dkLen: 32,
    });
    const packed = unb64(blob);
    const pt = xchacha20poly1305(key, packed.slice(0, 24)).decrypt(packed.slice(24));
    return JSON.parse(td.decode(pt)) as BackupPayload;
  } catch {
    return null;
  }
}

function auth(token: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token.replace(/^Bearer\s+/i, '').trim()}`,
  };
}

export async function uploadBackup(
  token: string,
  payload: BackupPayload,
  passphrase: string,
): Promise<boolean> {
  try {
    const { blob, salt, params } = encryptBackup(payload, passphrase);
    const res = await fetch(`${API_BASE_URL}/api/v1/e2ee/backup`, {
      method: 'PUT',
      headers: auth(token),
      body: JSON.stringify({
        blob,
        kdfSalt: salt,
        kdfParams: params,
        messageCount: Object.keys(payload.messages).length,
        sizeBytes: blob.length,
      }),
    });
    return res.ok;
  } catch (e) {
    console.warn('[e2ee] uploadBackup', e);
    return false;
  }
}

export async function downloadBackup(
  token: string,
  passphrase: string,
): Promise<BackupPayload | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/e2ee/backup`, {
      headers: auth(token),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const ro = json?.responseObject;
    if (!ro?.blob) return null;
    return decryptBackup(ro.blob, ro.kdfSalt, ro.kdfParams, passphrase);
  } catch (e) {
    console.warn('[e2ee] downloadBackup', e);
    return null;
  }
}

// Recovery codes live in masterKey.ts — that is where the wrapping they unlock
// is defined, and having two implementations invites them drifting apart.
export { generateRecoveryCode } from './masterKey';
