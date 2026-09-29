/**
 * The master key — "log in on any device and read your history", without the
 * server ever being able to read a message.
 *
 * THE DESIGN
 * ----------
 * A single random 32-byte MASTER KEY encrypts everything the user must not
 * lose: the message archive and their identity material.
 *
 *     masterKey   = 32 random bytes, generated once on the device
 *     wrappedKey  = encrypt(masterKey, Argon2id(passphrase, salt))
 *
 * Only `wrappedKey` goes to the server. It holds the locked box and never the
 * key to it, so it can hand the box to any device the user signs into — which
 * is precisely what removes data loss — while remaining unable to open it.
 *
 * This is the standard construction: Signal's Secure Value Recovery, 1Password,
 * and Bitwarden all work this way. It is the only way to have both properties
 * at once, and it is why the passphrase is the one secret that matters.
 *
 * WHY THE MASTER KEY IS SEPARATE FROM THE PASSPHRASE
 * Wrapping a stable master key (rather than encrypting data with the passphrase
 * directly) means changing the passphrase is a cheap RE-WRAP of 32 bytes, not a
 * re-encryption of the entire history. A password change is then instant, and
 * every device stays able to decrypt.
 *
 * RECOVERY
 * The master key is wrapped a SECOND time under a one-time recovery code, so a
 * forgotten passphrase is not the end of the user's history. Both wrappings
 * protect the same key; either one opens it.
 */
import { argon2id } from '@noble/hashes/argon2';
import { xchacha20poly1305 } from '@noble/ciphers/chacha';
import { randomBytes } from '@noble/hashes/utils';

import { API_BASE_URL } from '../../config/env';
import { b64, unb64 } from './identity';

const te = new TextEncoder();

/** 64 MiB / 3 passes — about a second on a mid-range phone. */
export const VAULT_KDF = { m: 65536, t: 3, p: 1 } as const;

function deriveWrappingKey(secret: string, salt: Uint8Array): Uint8Array {
  return argon2id(te.encode(secret), salt, {
    m: VAULT_KDF.m,
    t: VAULT_KDF.t,
    p: VAULT_KDF.p,
    dkLen: 32,
  });
}

function wrap(masterKey: Uint8Array, secret: string): { wrapped: string; salt: string } {
  const salt = randomBytes(16);
  const kek = deriveWrappingKey(secret, salt);
  const nonce = randomBytes(24);
  const ct = xchacha20poly1305(kek, nonce).encrypt(masterKey);
  const packed = new Uint8Array(nonce.length + ct.length);
  packed.set(nonce, 0);
  packed.set(ct, nonce.length);
  return { wrapped: b64(packed), salt: b64(salt) };
}

function unwrap(wrapped: string, saltB64: string, secret: string): Uint8Array | null {
  try {
    const kek = deriveWrappingKey(secret, unb64(saltB64));
    const packed = unb64(wrapped);
    return xchacha20poly1305(kek, packed.slice(0, 24)).decrypt(packed.slice(24));
  } catch {
    // Wrong passphrase. The AEAD tag is the only signal, and a wrong key must
    // fail cleanly rather than yield 32 bytes of garbage that would then be
    // used to "decrypt" the archive into nonsense.
    return null;
  }
}

/** A one-time 48-digit recovery code. ~159 bits — far stronger than a passphrase. */
export function generateRecoveryCode(): string {
  const bytes = randomBytes(20);
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  const digits = (n % 10n ** 48n).toString().padStart(48, '0');
  return (digits.match(/.{1,4}/g) ?? []).join('-');
}

export type VaultBlob = {
  wrappedKey: string;
  kdfSalt: string;
  kdfParams: string;
  recoveryWrappedKey?: string | null;
  recoverySalt?: string | null;
  version?: number;
};

/**
 * First-time setup: mint a master key and wrap it under both the passphrase and
 * a fresh recovery code. Returns the code ONCE — it is never stored in a form
 * this device or the server can read, so it must be shown to the user now.
 */
export function createVault(passphrase: string): {
  masterKey: Uint8Array;
  vault: VaultBlob;
  recoveryCode: string;
} {
  const masterKey = randomBytes(32);
  const recoveryCode = generateRecoveryCode();
  const primary = wrap(masterKey, passphrase);
  const recovery = wrap(masterKey, recoveryCode);
  return {
    masterKey,
    recoveryCode,
    vault: {
      wrappedKey: primary.wrapped,
      kdfSalt: primary.salt,
      kdfParams: JSON.stringify(VAULT_KDF),
      recoveryWrappedKey: recovery.wrapped,
      recoverySalt: recovery.salt,
      version: 1,
    },
  };
}

/** Sign-in on any device: unwrap with the passphrase, or with the recovery code. */
export function openVault(
  vault: VaultBlob,
  secret: string,
  mode: 'passphrase' | 'recovery' = 'passphrase',
): Uint8Array | null {
  if (mode === 'recovery') {
    if (!vault.recoveryWrappedKey || !vault.recoverySalt) return null;
    // Codes are shown grouped; accept them typed either way.
    return unwrap(vault.recoveryWrappedKey, vault.recoverySalt, secret.replace(/[\s-]/g, ''));
  }
  return unwrap(vault.wrappedKey, vault.kdfSalt, secret);
}

/**
 * Change the passphrase.
 *
 * Only the 32-byte master key is re-wrapped — the archive is untouched, so this
 * is instant regardless of how many messages exist, and every other device can
 * still decrypt because the master key itself never changed.
 */
export function rewrapVault(
  masterKey: Uint8Array,
  newPassphrase: string,
  existing: VaultBlob,
): VaultBlob {
  const primary = wrap(masterKey, newPassphrase);
  return {
    ...existing,
    wrappedKey: primary.wrapped,
    kdfSalt: primary.salt,
    kdfParams: JSON.stringify(VAULT_KDF),
    version: (existing.version ?? 1) + 1,
  };
}

function auth(token: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token.replace(/^Bearer\s+/i, '').trim()}`,
  };
}

export async function putVault(token: string, vault: VaultBlob): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/e2ee/vault`, {
      method: 'PUT',
      headers: auth(token),
      body: JSON.stringify(vault),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function getVault(token: string): Promise<VaultBlob | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/e2ee/vault`, { headers: auth(token) });
    if (!res.ok) return null;
    const json = await res.json();
    return (json?.responseObject as VaultBlob) ?? null;
  } catch {
    return null;
  }
}
