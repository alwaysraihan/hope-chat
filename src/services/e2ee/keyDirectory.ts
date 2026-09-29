/**
 * Talks to the server's public key directory.
 *
 * The server stores and serves PUBLIC key material only. Nothing here ever
 * transmits a private key — if it did, the encryption would not be end-to-end.
 */
import { API_BASE_URL } from '../../config/env';
import {
  generateOneTimePreKeys,
  publicBundle,
  remainingOneTimePreKeys,
  ONE_TIME_PREKEY_BATCH,
} from './identity';
import type { PeerBundle } from './x3dh';

/** Below this, top up: running out weakens forward secrecy for new sessions. */
const PREKEY_LOW_WATER = 20;

function auth(token: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token.replace(/^Bearer\s+/i, '').trim()}`,
  };
}

/**
 * Publish this device's bundle. Safe to call on every launch — the server
 * upserts, and one-time prekeys are only topped up when they run low, so this
 * is cheap after the first run.
 */
export async function publishKeys(token: string): Promise<boolean> {
  if (!token) return false;
  try {
    const needsTopUp = remainingOneTimePreKeys() < PREKEY_LOW_WATER;
    const oneTimePreKeys = needsTopUp
      ? generateOneTimePreKeys(ONE_TIME_PREKEY_BATCH).map(k => ({ id: k.id, pub: k.pub }))
      : [];
    const res = await fetch(`${API_BASE_URL}/api/v1/e2ee/keys`, {
      method: 'POST',
      headers: auth(token),
      body: JSON.stringify({ ...publicBundle(), oneTimePreKeys }),
    });
    if (!res.ok) {
      console.warn('[e2ee] publishKeys failed HTTP', res.status);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('[e2ee] publishKeys', e);
    return false;
  }
}

/**
 * Fetch a peer's bundles. Each call CONSUMES one one-time prekey per device
 * server-side, so call it only when establishing a session — not per message.
 */
export async function fetchPeerBundles(
  token: string,
  peerUserId: string,
): Promise<PeerBundle[]> {
  if (!token || !peerUserId) return [];
  try {
    const res = await fetch(
      `${API_BASE_URL}/api/v1/e2ee/keys/${encodeURIComponent(peerUserId)}`,
      { headers: auth(token) },
    );
    if (!res.ok) return [];
    const json = await res.json();
    const bundles = json?.responseObject?.bundles;
    return Array.isArray(bundles) ? (bundles as PeerBundle[]) : [];
  } catch {
    return [];
  }
}
