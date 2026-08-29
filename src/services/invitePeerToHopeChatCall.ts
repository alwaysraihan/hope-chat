import { API_BASE_URL } from '../config/env';

function bearer(accessToken: string): string {
  const t = accessToken.replace(/^Bearer\s+/i, '').trim();
  return t.length > 0 ? `Bearer ${t}` : '';
}

/**
 * Outcome of a ring attempt. `refused` means the server deliberately rejected the
 * call (blocked chat, pending message request, spam guard) and the caller should
 * NOT be sent to the call screen — otherwise they ring forever against nobody.
 * Anything else (network error, old server build, 5xx) stays soft: we let the call
 * proceed exactly as before rather than breaking calling on a transient failure.
 */
export type RingPeerResult =
  | { ok: true }
  | { ok: false; refused: true; message: string; reason?: string }
  | { ok: false; refused: false };

/**
 * Tells the Hopenity API to FCM the peer so their Hope Chat shows IncomingCall (same room as caller).
 * Soft-fails on transport/server errors; reports explicit refusals so the UI can show them.
 */
export async function notifyPeerIncomingHopeChatCall(params: {
  token: string | null | undefined;
  conversationId: string;
  liveKitRoom: string;
  callKind: 'audio' | 'video';
}): Promise<RingPeerResult> {
  const auth = params.token ? bearer(params.token) : '';
  if (!auth) return { ok: false, refused: false };
  const cid = String(params.conversationId ?? '').trim();
  if (!cid) return { ok: false, refused: false };
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
    if (res.ok) return { ok: true };

    const text = await res.text().catch(() => '');
    console.warn('[HopeChat] hopechat-call-invite', res.status, text.slice(0, 240));

    // 403 (blocked / request pending) and 429 (spam guard) are deliberate refusals
    // carrying a message meant for the caller. Every other status is treated as a
    // soft failure so an outage or an old server build never blocks calling.
    if (res.status === 403 || res.status === 429) {
      let message = '';
      let reason: string | undefined;
      try {
        const body = JSON.parse(text) as {
          message?: string;
          responseObject?: { reason?: string };
        };
        message = typeof body?.message === 'string' ? body.message.trim() : '';
        reason = body?.responseObject?.reason;
      } catch {
        /* non-JSON error body — fall through to the generic message */
      }
      return {
        ok: false,
        refused: true,
        message: message || "This call can't be completed.",
        reason,
      };
    }
    return { ok: false, refused: false };
  } catch (e) {
    if (__DEV__) {
      console.warn('[HopeChat] hopechat-call-invite network', e);
    }
    return { ok: false, refused: false };
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
  /**
   * 'hangup' = the call had already been answered and is now being ended. The
   * peer still needs the teardown signal, but the server must not write a
   * "Missed call" row for a conversation that actually happened. Omitted for a
   * pre-answer cancel/decline, which IS a missed call.
   */
  reason?: 'hangup';
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
      body: JSON.stringify({
        liveKitRoom: params.liveKitRoom,
        ...(params.reason ? { reason: params.reason } : {}),
      }),
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

/**
 * End a call by LiveKit room name — used for EVERY hangup, answered or not.
 *
 * Why not the per-chat cancel endpoint: not every call screen knows the
 * conversation id, and a wrong id tears down the wrong conversation's call. The
 * server records the room's two participants when the call is invited, so it can
 * route the teardown itself from the room name alone.
 *
 * This is the second of two teardown channels. The first is the LiveKit data
 * channel, which only reaches a peer already joined to the room — silent while
 * the callee is still ringing, or once their connection has dropped. Whichever
 * signal lands first ends the call; the other is a harmless no-op.
 *
 * Fire-and-forget: a hangup must never be blocked or fail visibly.
 */
export async function notifyCallEndedByRoom(params: {
  token: string | null | undefined;
  liveKitRoom: string;
  /** 'hangup' = the call was answered; the server must not log a missed call. */
  reason?: 'hangup';
}): Promise<void> {
  const auth = params.token ? bearer(params.token) : '';
  if (!auth) return;
  const room = String(params.liveKitRoom ?? '').trim();
  if (!room) return;
  try {
    const base = API_BASE_URL.replace(/\/+$/, '');
    const res = await fetch(`${base}/api/v1/chats/hopechat-call-end`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: auth,
      },
      body: JSON.stringify({
        liveKitRoom: room,
        ...(params.reason ? { reason: params.reason } : {}),
      }),
    });
    if (__DEV__ && !res.ok) {
      console.warn('[HopeChat] hopechat-call-end', res.status);
    }
  } catch (e) {
    if (__DEV__) console.warn('[HopeChat] hopechat-call-end network', e);
  }
}
