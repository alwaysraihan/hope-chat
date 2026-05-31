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

/**
 * Invites a contact (via their 1:1 conversation) to join an already-active call room.
 * Used for the "Add people" feature during an ongoing call.
 */
export async function inviteContactToExistingCall(params: {
  token: string | null | undefined;
  /** 1:1 conversation ID with the contact you want to invite */
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
    await fetch(url, {
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
  } catch (e) {
    if (__DEV__) console.warn('[HopeChat] inviteContactToExistingCall network', e);
  }
}

/**
 * Notifies the Hopenity API that the callee rejected the call so the server can
 * send a `call_cancelled` FCM to the caller — stopping their outgoing ring immediately.
 * Fire-and-forget — gracefully degrades if the endpoint doesn't exist yet.
 */
export async function notifyPeerCallRejected(params: {
  token: string | null | undefined;
  conversationId: string;
  liveKitRoom: string;
}): Promise<void> {
  const auth = params.token ? bearer(params.token) : '';
  if (!auth) return;
  const cid = String(params.conversationId ?? '').trim();
  if (!cid) return;
  try {
    const base = API_BASE_URL.replace(/\/+$/, '');
    const url = `${base}/api/v1/chats/${encodeURIComponent(cid)}/hopechat-call-cancel`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: auth,
      },
      body: JSON.stringify({ liveKitRoom: params.liveKitRoom }),
    });
    if (__DEV__ && !res.ok) {
      const text = await res.text().catch(() => '');
      console.warn('[HopeChat] hopechat-call-cancel', res.status, text.slice(0, 240));
    }
  } catch (e) {
    if (__DEV__) {
      console.warn('[HopeChat] hopechat-call-cancel network', e);
    }
  }
}
