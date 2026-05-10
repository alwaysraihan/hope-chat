import type { MediaPayload } from '../components/types/chat';
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
  messageKind?: 'call_log' | 'voice_note' | 'text';
  delivery?: {
    state: 'sent' | 'delivered' | 'read';
    readAt?: string;
  };
  media?: import('../components/types/chat').MediaPayload;
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

  return { text: messageText, messageKind: 'text', delivery };
}
