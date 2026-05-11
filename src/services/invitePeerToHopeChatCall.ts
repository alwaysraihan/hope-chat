import { API_BASE_URL } from '../config/env';

function bearer(accessToken: string): string {
  const t = accessToken.replace(/^Bearer\s+/i, '').trim();
  return t.length > 0 ? `Bearer ${t}` : '';
}

/**
 * Tells the Hopenity API to FCM the peer so their Hope Chat shows IncomingCall (same room as caller).
 * Fire-and-forget — call still works if this fails (e.g. old server build).
 */
export async function notifyPeerIncomingHopeChatCall(params: {
  token: string | null | undefined;
  conversationId: string;
  liveKitRoom: string;
  callKind: 'audio' | 'video';
}): Promise<void> {
  const auth = params.token ? bearer(params.token) : '';
  if (!auth) return;
  const cid = String(params.conversationId ?? '').trim();
  if (!cid) return;
  try {
    const base = API_BASE_URL.replace(/\/+$/, '');
    const url = `${base}/api/v1/chats/${encodeURIComponent(cid)}/hopechat-call-invite`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: auth,
      },
      body: JSON.stringify({
        liveKitRoom: params.liveKitRoom,
        callKind: params.callKind,
      }),
    });
    if (__DEV__ && !res.ok) {
      const text = await res.text().catch(() => '');
      console.warn('[HopeChat] hopechat-call-invite', res.status, text.slice(0, 240));
    }
  } catch (e) {
    if (__DEV__) {
      console.warn('[HopeChat] hopechat-call-invite network', e);
    }
  }
}
