/**
 * The archive — what actually delivers "log in anywhere, lose nothing".
 *
 * This is the piece that connects the vault to real data. Without it the
 * passphrase screen is theatre: a user could set a passphrase, see a recovery
 * code, and still lose every message on reinstall, because nothing was ever
 * written anywhere they could get it back from.
 *
 *   masterKey  unlocked from the vault with the user's passphrase
 *   archive    = encrypt(all decrypted message bodies, masterKey)  -> server
 *
 * The server stores an opaque blob. On a new device the user unlocks the vault,
 * downloads the blob, and their history is back — while the server remains
 * unable to read any of it.
 *
 * WHEN IT SYNCS
 * Uploading on every message would be wasteful and would leak timing. Instead
 * it is debounced and only runs when something actually changed, which keeps
 * the cost proportional to activity rather than to message volume.
 */
import { createMMKV, type MMKV } from 'react-native-mmkv';

import { encryptBackup, decryptBackup, type BackupPayload } from './encryptedBackup';
import { b64 } from './identity';
import { API_BASE_URL } from '../../config/env';

let _store: MMKV | null = null;
function store(): MMKV {
  if (!_store) _store = createMMKV({ id: 'hopechat-e2ee-plaintext-v1' });
  return _store;
}

/**
 * The unlocked master key, held in memory only.
 *
 * Deliberately NOT persisted: writing it to disk unwrapped would make the
 * passphrase pointless, since anyone with the device could read it directly.
 * It is re-derived from the vault each time the user unlocks.
 */
let unlockedMasterKey: Uint8Array | null = null;

export function setMasterKey(key: Uint8Array | null): void {
  unlockedMasterKey = key;
}

export function isUnlocked(): boolean {
  return unlockedMasterKey != null;
}

export function lockArchive(): void {
  unlockedMasterKey = null;
}

/** Collect every decrypted body this device holds. */
function collectMessages(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (const key of store().getAllKeys()) {
      if (!key.startsWith('p:')) continue;
      const value = store().getString(key);
      if (value) out[key.slice(2)] = value;
    }
  } catch {
    /* a partial archive still beats none */
  }
  return out;
}

function restoreMessages(messages: Record<string, string>): number {
  let n = 0;
  for (const [id, text] of Object.entries(messages)) {
    try {
      // Never overwrite a locally decrypted message with an older archived
      // copy — the local one came from the live ratchet and is authoritative.
      if (store().getString(`p:${id}`)) continue;
      store().set(`p:${id}`, text);
      n += 1;
    } catch {
      /* skip */
    }
  }
  return n;
}

function auth(token: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token.replace(/^Bearer\s+/i, '').trim()}`,
  };
}

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let dirty = false;

/** Called whenever a message is decrypted or sent. Cheap: just sets a flag. */
export function markArchiveDirty(): void {
  dirty = true;
}

/**
 * Upload the archive if anything changed. Debounced so a burst of messages
 * produces one upload rather than dozens.
 */
export function scheduleArchiveSync(token: string, delayMs = 30_000): void {
  if (!token || !unlockedMasterKey) return;
  if (syncTimer) return;
  syncTimer = setTimeout(() => {
    syncTimer = null;
    if (!dirty) return;
    dirty = false;
    void uploadArchiveNow(token);
  }, delayMs);
}

export async function uploadArchiveNow(token: string): Promise<boolean> {
  const key = unlockedMasterKey;
  if (!token || !key) return false;
  try {
    const payload: BackupPayload = {
      messages: collectMessages(),
      createdAt: Date.now(),
    };
    // encryptBackup takes a passphrase; the master key IS the secret here, so
    // it is passed as raw key material rather than re-running a KDF over it.
    const sealed = encryptBackup(payload, b64(key));
    const res = await fetch(`${API_BASE_URL}/api/v1/e2ee/backup`, {
      method: 'PUT',
      headers: auth(token),
      body: JSON.stringify({
        blob: sealed.blob,
        kdfSalt: sealed.salt,
        kdfParams: sealed.params,
        messageCount: Object.keys(payload.messages).length,
        sizeBytes: sealed.blob.length,
      }),
    });
    return res.ok;
  } catch (e) {
    console.warn('[e2ee] archive upload', e);
    return false;
  }
}

/**
 * New device: pull the archive and merge it into local storage.
 * Returns how many messages were restored, or -1 if it could not be read.
 */
export async function restoreArchive(token: string): Promise<number> {
  const key = unlockedMasterKey;
  if (!token || !key) return -1;
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/e2ee/backup`, {
      headers: auth(token),
    });
    if (!res.ok) return 0; // no archive yet is not a failure
    const json = await res.json();
    const ro = json?.responseObject;
    if (!ro?.blob) return 0;
    const payload = decryptBackup(
      ro.blob,
      ro.kdfSalt,
      ro.kdfParams,
      b64(key),
    );
    if (!payload) return -1;
    return restoreMessages(payload.messages ?? {});
  } catch (e) {
    console.warn('[e2ee] archive restore', e);
    return -1;
  }
}
