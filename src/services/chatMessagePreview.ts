import type { DonationRequestPayload, DonationRequestType, MediaPayload } from '../components/types/chat';
import { normalizeChatUserId } from '../utils/chatUserId';

/** Last message row from chat list API — extend as backend adds fields. */
export type ApiLastMessageLike = {
  content?: string;
  createdAt?: string;
  created_at?: string;
  senderId?: string;
  messageType?: string;
  type?: string;
  kind?: string;
  /** seconds */
  duration?: number;
  durationSeconds?: number;
  talkingTime?: number;
  talkingTimeSeconds?: number;
  callDurationSeconds?: number;
  missed?: boolean;
  callKind?: 'audio' | 'video' | string;
  metadata?: Record<string, unknown>;
};

export function formatSecondsToClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

function numFromUnknown(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function durationSecondsFromMessage(m: ApiLastMessageLike): number | undefined {
  const meta = m.metadata ?? {};
  return (
    numFromUnknown(m.durationSeconds) ??
    numFromUnknown(m.callDurationSeconds) ??
    numFromUnknown(m.talkingTimeSeconds) ??
    numFromUnknown(m.talkingTime) ??
    numFromUnknown(m.duration) ??
    numFromUnknown(meta.talkingTime) ??
    numFromUnknown(meta.talkingTimeSeconds) ??
    numFromUnknown(meta.durationSeconds) ??
    numFromUnknown(meta.callDurationSeconds)
  );
}

/**
 * Inbox / home list subtitle — matches WhatsApp-style call + voice lines when API sends types.
 * Backend: set `messageType`, durations, `missed`, `callKind` on `lastMessage`.
 */
export function formatChatListPreview(
  last: ApiLastMessageLike,
  localUserId: string,
): string {
  const local = normalizeChatUserId(localUserId) || String(localUserId ?? '');
  const senderIsLocal =
    !!last.senderId && normalizeChatUserId(last.senderId) === local;

  const rawType = String(
    last.messageType ?? last.type ?? last.kind ?? '',
  ).toLowerCase();
  const meta = last.metadata ?? {};
  const metaType = String(
    (meta.messageType as string) ??
      (meta.type as string) ??
      (meta.kind as string) ??
      '',
  ).toLowerCase();
  const combined = `${rawType} ${metaType}`.trim();

  const missed =
    last.missed === true ||
    meta.missed === true ||
    combined.includes('missed');

  const durationSec = durationSecondsFromMessage(last);
  const durClock =
    durationSec != null && durationSec > 0
      ? formatSecondsToClock(durationSec)
      : null;

  const isVideo =
    combined.includes('video') ||
    last.callKind === 'video' ||
    meta.callKind === 'video';
  const isVoiceMsg =
    combined.includes('voice') ||
    combined.includes('audio_message') ||
    combined === 'voice';

  // Voice note (not a live call)
  if (isVoiceMsg && !combined.includes('call')) {
    const base = durClock ? `🎤 Voice message · ${durClock}` : '🎤 Voice message';
    return senderIsLocal ? `You: ${base}` : base;
  }

  if (combined.includes('donation_request') || rawType === 'donation_request') {
    const base = '💝 Donation request';
    return senderIsLocal ? `You: ${base}` : base;
  }
  // Web-generated structured messages: content starts with "JSON:{...}"
  const contentStr = String(last.content ?? '').trimStart();
  if (contentStr.startsWith('JSON:')) {
    try {
      const parsed = JSON.parse(contentStr.slice(5)) as Record<string, unknown>;
      const type = String(parsed.type ?? '').toLowerCase();
      if (type === 'donation_request') {
        const sub = String(parsed.requestType ?? parsed.subType ?? parsed.category ?? '').toLowerCase();
        const emoji = sub.includes('blood') ? '🩸' : sub.includes('food') ? '🍽️' : sub.includes('essential') || sub.includes('product') ? '📦' : '💝';
        const label = sub.includes('blood') ? 'Blood donation request' : sub.includes('food') ? 'Food donation request' : sub.includes('essential') || sub.includes('product') ? 'Essential request' : 'Donation request';
        const base = `${emoji} ${label}`;
        return senderIsLocal ? `You: ${base}` : base;
      }
    } catch { /* not valid JSON — fall through */ }
  }

  if (
    combined.includes('call') ||
    combined.includes('rtc') ||
    last.callKind != null
  ) {
    if (missed) {
      const label = isVideo ? '📹 Missed video call' : '📞 Missed voice call';
      return senderIsLocal ? `You: ${label}` : label;
    }
    const kindLabel = isVideo ? '📹 Video call' : '📞 Voice call';
    const line =
      durClock != null ? `${kindLabel} · ${durClock}` : `${kindLabel}`;
    return senderIsLocal ? `You: ${line}` : line;
  }

  // Fallback: plain text preview (length capped in caller)
  const trimmed = String(last.content ?? '').trim();
  if (!trimmed) {
    if (durClock) {
      const fallback = `🎤 ${durClock}`;
      return senderIsLocal ? `You: ${fallback}` : fallback;
    }
    return '';
  }
  if (/^https?:\/\/.+\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(trimmed)) {
    const label = '📷 Photo';
    return senderIsLocal ? `You: ${label}` : label;
  }
  if (/^https?:\/\/.+\.(mp4|mov|webm)(\?|$)/i.test(trimmed)) {
    const label = '🎬 Video';
    return senderIsLocal ? `You: ${label}` : label;
  }
  const base =
    trimmed.length > 140 ? `${trimmed.slice(0, 137)}…` : trimmed;
  return senderIsLocal ? `You: ${base}` : base;
}

export type ParsedApiMessage = {
  text: string;
  messageKind?: 'call_log' | 'voice_note' | 'text' | 'donation_request' | 'system';
  donationRequest?: DonationRequestPayload;
  delivery?: {
    state: 'sent' | 'delivered' | 'read';
    readAt?: string;
  };
  media?: MediaPayload;
};

/** Build inbox bubble text + flags from a raw API message row. */
export function mapApiMessageToTimeline(
  raw: Record<string, unknown>,
): ParsedApiMessage {
  const meta =
    (raw.metadata as Record<string, unknown> | undefined) ?? {};
  const messageText = String(
    raw.content ?? raw.text ?? '',
  );
  const rawType = String(
    raw.messageType ?? raw.type ?? raw.kind ?? meta.messageType ?? '',
  ).toLowerCase();
  const combined = `${rawType} ${
    String(meta.type ?? meta.kind ?? '')
  }`.trim();

  const missed =
    raw.missed === true ||
    meta.missed === true ||
    combined.includes('missed');

  const durationSec =
    numFromUnknown(raw.durationSeconds) ??
    numFromUnknown(raw.callDurationSeconds) ??
    numFromUnknown(raw.talkingTimeSeconds) ??
    numFromUnknown(raw.talkingTime) ??
    numFromUnknown(raw.duration) ??
    numFromUnknown(meta.talkingTimeSeconds) ??
    numFromUnknown(meta.durationSeconds);

  const durClock =
    durationSec != null && durationSec > 0
      ? formatSecondsToClock(durationSec)
      : null;

  const isVideo =
    combined.includes('video') ||
    raw.callKind === 'video' ||
    meta.callKind === 'video';
  const isCall =
    combined.includes('call') ||
    combined.includes('rtc') ||
    raw.callKind != null ||
    meta.callKind != null;

  /** Delivery / read pipeline — populate when backend sends receipts. */
  let delivery: ParsedApiMessage['delivery'] | undefined;
  if (
    raw.readAt ||
    raw.recipientRead === true ||
    raw.read === true ||
    meta.recipientRead === true ||
    meta.read === true
  ) {
    delivery = { state: 'read', readAt: String(raw.readAt ?? meta.readAt ?? '') };
  } else if (
    raw.deliveredAt ||
    raw.delivered === true ||
    raw.deliveryStatus === 'delivered' ||
    meta.delivered === true
  ) {
    delivery = { state: 'delivered' };
  } else if (raw.deliveryStatus === 'sent' || raw.status === 'sent') {
    delivery = { state: 'sent' };
  }

  function parseDonationRequestType(raw: string | undefined): DonationRequestType {
    const s = String(raw ?? '').toLowerCase();
    if (s.includes('blood')) return 'blood';
    if (s.includes('food')) return 'food';
    if (s.includes('essential')) return 'essential';
    if (s.includes('product')) return 'product';
    return 'general';
  }

  // Backend membership announcements ("X added Y", "X joined via invite link")
  // arrive with messageType "system" — render as a centered timeline row.
  if (rawType === 'system') {
    return { text: messageText, messageKind: 'system' };
  }

  // Web-generated structured messages use content "JSON:{...}" with a plain text type.
  // Detect and parse them so the DonationRequestBubble renders instead of raw JSON.
  if (messageText.startsWith('JSON:')) {
    try {
      const parsed = JSON.parse(messageText.slice(5)) as Record<string, unknown>;
      const embType = String(parsed.type ?? '').toLowerCase();
      if (embType === 'donation_request') {
        const donationId = numFromUnknown(parsed.donationId) ?? 0;
        const postId = String(parsed.postId ?? '');
        const text = String(parsed.text ?? 'I am interested in this.');
        const requestType = parseDonationRequestType(
          String(parsed.requestType ?? parsed.subType ?? parsed.category ?? ''),
        );
        const rawEmbStatus = String(parsed.status ?? 'PENDING').toUpperCase();
        const embStatus: DonationRequestPayload['status'] =
          rawEmbStatus === 'ACCEPTED' || rawEmbStatus === 'REJECTED' ? rawEmbStatus : 'PENDING';
        return {
          text,
          messageKind: 'donation_request',
          donationRequest: { donationId, postId, status: embStatus, requestType },
          delivery,
        };
      }
    } catch { /* not valid JSON — fall through */ }
  }

  if (rawType === 'donation_request') {
    const donationId =
      numFromUnknown(raw.donationId) ??
      numFromUnknown((meta as Record<string, unknown>).donationId) ??
      0;
    const postId = String(
      raw.postId ?? (meta as Record<string, unknown>).postId ?? '',
    );
    const rawStatus = String(
      raw.status ?? (meta as Record<string, unknown>).status ?? 'PENDING',
    ).toUpperCase();
    const status: DonationRequestPayload['status'] =
      rawStatus === 'ACCEPTED' || rawStatus === 'REJECTED'
        ? rawStatus
        : 'PENDING';
    const requestType = parseDonationRequestType(
      String(raw.requestType ?? raw.subType ?? raw.category ?? meta.requestType ?? ''),
    );
    return {
      text: messageText || 'I am interested in this.',
      messageKind: 'donation_request',
      donationRequest: { donationId, postId, status, requestType },
      delivery,
    };
  }

  if (isCall) {
    if (missed) {
      const label = isVideo ? '📹 Missed video call' : '📞 Missed voice call';
      return { text: label, messageKind: 'call_log', delivery };
    }
    const kindLabel = isVideo ? '📹 Video call' : '📞 Voice call';
    const text =
      durClock != null ? `${kindLabel} · ${durClock}` : kindLabel;
    return { text, messageKind: 'call_log', delivery };
  }

  if (
    combined.includes('voice') ||
    combined.includes('audio_message') ||
    rawType === 'voice'
  ) {
    const base = durClock
      ? `🎤 Voice message · ${durClock}`
      : '🎤 Voice message';
    if (messageText.trim().match(/^https?:\/\//i)) {
      return {
        text: base,
        messageKind: 'voice_note',
        media: {
          type: 'voice',
          remoteUri: messageText.trim(),
          duration: durationSec ?? 0,
        },
        delivery,
      };
    }
    return { text: base, messageKind: 'voice_note', delivery };
  }

  const looksLikeImageOnly =
    /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(messageText.trim());
  if (looksLikeImageOnly) {
    return {
      text: '',
      media: {
        type: 'image',
        url: messageText.trim(),
        remoteUri: messageText.trim(),
      },
      messageKind: 'text',
      delivery,
    };
  }

  const looksLikeVideoOnly =
    /^https?:\/\/.+\.(mp4|mov|m3u8|webm|mkv|avi|3gp|m4v)(\?|$)/i.test(messageText.trim());
  if (looksLikeVideoOnly) {
    return {
      text: '',
      media: {
        type: 'video',
        url: messageText.trim(),
        remoteUri: messageText.trim(),
      },
      messageKind: 'text',
      delivery,
    };
  }

  return { text: messageText, messageKind: 'text', delivery };
}
