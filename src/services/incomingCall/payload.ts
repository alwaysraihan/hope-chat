/**
 * FCM/APNs data payload keys your backend should send for incoming calls.
 *
 * Android (app killed / background): use a **data** message (not notification-only) with
 * `android.priority: "high"` so `setBackgroundMessageHandler` can show the ringing tray + full-screen intent.
 */
export type IncomingCallPayload = {
  callKind: 'audio' | 'video';
  /** LiveKit room name (matches existing call screens) */
  liveKitRoom: string;
  displayName: string;
  callerId?: string;
  /** Caller profile image URL when push includes it */
  avatarUrl?: string;
  /** Optional chat id for missed-call timeline rows */
  conversationId?: string;
  /** When true IncomingCallScreen skips the ringing UI and accepts immediately */
  autoAccept?: boolean;
  /** Group call — ring screen shows the group name instead of the caller */
  isGroupCall?: boolean;
  groupName?: string;
  groupPhotoUrl?: string;
};

export const TYPE_KEY = 'type';
/** Send this in `data.type` when using strict routing */
export const INCOMING_CALL_MESSAGE_TYPE = 'incoming_call';
/** Send this when a call is answered on another device or the caller hung up before answer */
export const CALL_CANCELLED_MESSAGE_TYPE = 'call_cancelled';

function pickString(record: Record<string, string>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = record[k];
    if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  }
  return undefined;
}

/** Firebase RemoteMessage.data flattened to strings */
export function normalizeFcmData(
  data: Record<string, unknown> | undefined | null,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!data || typeof data !== 'object') return out;
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === 'string') out[k] = v;
    else if (v != null && (typeof v === 'number' || typeof v === 'boolean'))
      out[k] = String(v);
  }
  return out;
}

export function parseIncomingCallPayload(
  data: Record<string, string> | undefined | null,
): IncomingCallPayload | null {
  if (!data) return null;

  const typeNorm =
    pickString(
      data,
      TYPE_KEY,
      'messageType',
      'notification_type',
      'category',
    )?.toLowerCase() ?? '';
  const incomingFlag = pickString(
    data,
    'incoming',
    'isIncoming',
  )?.toLowerCase();
  const flagIncoming =
    incomingFlag === '1' || incomingFlag === 'true' || incomingFlag === 'yes';
  const hopechatCallFlag = pickString(
    data,
    'hopechat_call',
    'hopeChatCall',
    'incomingCall',
  )?.toLowerCase();
  const flagHopechatCall =
    hopechatCallFlag === '1' ||
    hopechatCallFlag === 'true' ||
    hopechatCallFlag === 'yes';
  const isCallIntent =
    typeNorm === INCOMING_CALL_MESSAGE_TYPE ||
    typeNorm === 'incoming_call' ||
    typeNorm === 'call' ||
    typeNorm === 'voip_incoming' ||
    typeNorm === 'call_incoming' ||
    typeNorm === 'hopechat_incoming_call' ||
    flagIncoming ||
    flagHopechatCall;

  const liveKitRoom = pickString(
    data,
    'liveKitRoom',
    'room',
    'live_kit_room',
    'livekit_room',
    'roomName',
    'livekitRoom',
  );

  const displayName =
    pickString(
      data,
      'displayName',
      'callerName',
      'caller',
      'name',
      'title',
    ) ?? 'Incoming call';

  if (!liveKitRoom || !isCallIntent) return null;

  const kindRaw =
    pickString(data, 'callKind', 'medium', 'call_mode')?.toLowerCase() ??
    '';

  let callKind: 'audio' | 'video';
  if (kindRaw.includes('video')) callKind = 'video';
  else if (
    kindRaw.includes('audio') ||
    kindRaw.includes('voice') ||
    kindRaw.includes('rtc')
  ) {
    callKind = 'audio';
  } else {
    callKind =
      pickString(data, 'callType')?.toLowerCase().includes('video') === true
        ? 'video'
        : 'audio';
  }

  const callerId = pickString(data, 'callerId', 'caller_id', 'from', 'senderId');

  const avatarUrl = pickString(
    data,
    'avatarUrl',
    'callerAvatar',
    'caller_avatar',
    'profileImage',
    'profile_image',
    'image',
    'photoUrl',
    'photo_url',
  );

  const conversationId = pickString(
    data,
    'conversationId',
    'chatId',
    'conversation_id',
    'chat_id',
  );

  // Reject stale call invites — prevents ghost IncomingCallScreen after call ends.
  // FCM can deliver messages minutes late on congested networks; a ts > 30s old
  // means the call has already timed out or ended on the caller's side.
  const tsStr = pickString(data, 'ts', 'timestamp', 'sentAt');
  if (tsStr) {
    const sentAt = Number(tsStr);
    if (Number.isFinite(sentAt) && Date.now() - sentAt > 30_000) {
      // Silently drop — this FCM arrived too late.
      return null;
    }
  }

  // Group-call fields — backend sends isGroupCall: "true" + groupName/groupPhotoUrl
  // so the ring screen can show "{caller} started a call in {group}".
  const groupFlag = pickString(data, 'isGroupCall', 'is_group_call')?.toLowerCase();
  const isGroupCall = groupFlag === '1' || groupFlag === 'true' || groupFlag === 'yes';
  const groupName = pickString(data, 'groupName', 'group_name');
  const groupPhotoUrl = pickString(data, 'groupPhotoUrl', 'group_photo_url');

  return {
    callKind,
    liveKitRoom,
    displayName,
    callerId,
    avatarUrl,
    conversationId,
    isGroupCall: isGroupCall || undefined,
    groupName,
    groupPhotoUrl,
  };
}
