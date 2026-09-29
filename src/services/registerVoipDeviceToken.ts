import { createMMKV, type MMKV } from 'react-native-mmkv';
import { API_BASE_URL } from '../config/env';

const VOIP_TOKEN_ENDPOINT = '/api/v1/users/voip-token';

let _store: MMKV | null = null;
function store(): MMKV {
  if (!_store) _store = createMMKV({ id: 'hopechat-voip-token-v1' });
  return _store;
}
const LAST_TOKEN_KEY = 'lastVoipToken';

/**
 * The VoIP token only arrives via RNVoipPushNotification's `register` event
 * (IncomingCallListener.tsx), not on demand — logout needs it to unregister
 * server-side but can't wait on that event, so the last one seen is cached
 * here instead.
 */
export function rememberVoipToken(token: string): void {
  if (!token) return;
  try {
    store().set(LAST_TOKEN_KEY, token);
  } catch {
    /* best-effort */
  }
}

export function readLastKnownVoipToken(): string | null {
  try {
    return store().getString(LAST_TOKEN_KEY) ?? null;
  } catch {
    return null;
  }
}

function bearerHeader(accessToken: string): string {
  const t = accessToken.replace(/^Bearer\s+/i, '').trim();
  return t.length > 0 ? `Bearer ${t}` : '';
}

/**
 * POST the iOS VoIP (PushKit) registration token so the server can wake this
 * device for an incoming call even when it's backgrounded or fully killed —
 * a regular FCM/APNs push cannot do that reliably; only a VoIP push can.
 *
 * This is a SEPARATE token from the regular FCM one (`registerFcmDeviceToken.ts`)
 * and must be sent to APNs directly with the app's VoIP Services certificate,
 * not through Firebase's normal send path. Backend: `/api/v1/users/voip-token`.
 */
export async function postVoipTokenToHopenity(
  accessToken: string,
  voipToken: string,
): Promise<{ ok: boolean; status: number }> {
  const auth = bearerHeader(accessToken);
  if (!auth || !voipToken.trim()) {
    return { ok: false, status: 0 };
  }
  const url = `${API_BASE_URL.replace(/\/+$/, '')}${VOIP_TOKEN_ENDPOINT}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: auth,
      },
      body: JSON.stringify({ token: voipToken.trim(), app: 'hopechat' }),
    });
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

/** DELETE the VoIP token on logout — same reasoning as the FCM token cleanup. */
export async function deleteVoipTokenFromHopenity(
  accessToken: string,
  voipToken: string,
): Promise<{ ok: boolean; status: number }> {
  const auth = bearerHeader(accessToken);
  if (!auth || !voipToken.trim()) {
    return { ok: false, status: 0 };
  }
  const url = `${API_BASE_URL.replace(/\/+$/, '')}${VOIP_TOKEN_ENDPOINT}`;
  try {
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: auth,
      },
      body: JSON.stringify({ token: voipToken.trim() }),
    });
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  }
}
