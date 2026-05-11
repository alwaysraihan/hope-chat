import { API_BASE_URL } from '../config/env';

const FCM_TOKEN_ENDPOINT = '/api/v1/users/fcm-token';

function bearerHeader(accessToken: string): string {
  const t = accessToken.replace(/^Bearer\s+/i, '').trim();
  return t.length > 0 ? `Bearer ${t}` : '';
}

/** POST FCM registration token so the server can send incoming-call pushes (same contract as Hopenity app). */
export async function postFcmTokenToHopenity(
  accessToken: string,
  fcmToken: string,
): Promise<{ ok: boolean; status: number }> {
  const auth = bearerHeader(accessToken);
  if (!auth || !fcmToken.trim()) {
    return { ok: false, status: 0 };
  }
  const url = `${API_BASE_URL.replace(/\/+$/, '')}${FCM_TOKEN_ENDPOINT}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: auth,
    },
    body: JSON.stringify({ token: fcmToken.trim() }),
  });
  return { ok: res.ok, status: res.status };
}
