/**
 * Resolved from `src/config/env.ts`, which reads `.env` (see `.env.example`).
 */

import { Platform } from 'react-native';
import {
  VideoPresets,
  type RoomConnectOptions,
  type RoomOptions,
} from 'livekit-client';

import {
  LIVEKIT_URL,
  LIVEKIT_WS_URL,
  LIVEKIT_TOKEN_SERVICE_URL,
  LIVEKIT_ISSUER_SECRET,
  LIVEKIT_DEV_TOKEN,
} from './env';

/** Self-hosted stack — DNS A/AAAA → LiveKit VPS, TLS via Nginx. */
export const LIVEKIT_DEFAULT_HOSTNAME = 'livekit.hopenity.com';

const trim = (v: string | undefined) => (typeof v === 'string' ? v.trim() : '');

/** Derive signaling URL from LIVEKIT_URL (https → wss). */
function wssUrlFromHttpsBase(httpsBase: string): string | null {
  try {
    const u = new URL(httpsBase.trim());
    if (!/^https?:$/i.test(u.protocol)) return null;
    return `${u.protocol === 'https:' ? 'wss' : 'ws'}://${u.host}`;
  } catch {
    return null;
  }
}

const DEFAULT_RELEASE_WSS = `wss://${LIVEKIT_DEFAULT_HOSTNAME}`;
const DEFAULT_RELEASE_MINT_BASE = `https://${LIVEKIT_DEFAULT_HOSTNAME}`;

const trimmedLivekitUrl = trim(LIVEKIT_URL);
const derivedWsFromUrl =
  trimmedLivekitUrl.length > 0 ? wssUrlFromHttpsBase(trimmedLivekitUrl) : null;

/** Used when LIVEKIT_DEV_TOKEN is set — must be ws(s): for physical devices use LAN/VPS URLs, not localhost. */
export const resolvedLiveKitWsUrl =
  trim(LIVEKIT_WS_URL) ||
  derivedWsFromUrl ||
  (__DEV__ ? 'ws://127.0.0.1:7880' : DEFAULT_RELEASE_WSS);

/** JWT mint base — same hostname as signaling (`POST …/v1/livekit/token`). */
export const resolvedLiveKitTokenBaseUrl =
  trim(LIVEKIT_TOKEN_SERVICE_URL) ||
  trim(LIVEKIT_URL) ||
  (__DEV__ ? '' : DEFAULT_RELEASE_MINT_BASE);

export const resolvedLiveKitIssuerSecret = trim(LIVEKIT_ISSUER_SECRET);

/** Dev bypass only — omit in production bundles. */
export const resolvedLiveKitDevToken = trim(LIVEKIT_DEV_TOKEN);

export const LIVEKIT_FALLBACK_ROOM = 'hope-chat';

export function liveKitDevBypassEnabled(): boolean {
  return resolvedLiveKitDevToken.length > 0;
}

/** Whether the app should POST to your self-hosted token issuer (OSS LiveKit JWT mint). */
export function liveKitMintConfigured(): boolean {
  const u = resolvedLiveKitTokenBaseUrl;
  return u.length > 0 && /^https?:\/\//i.test(u);
}

/** Server must have TOKEN_ISSUER_SECRET matching this header value; omit secret on both ends for OSS-only setups. */
export function liveKitMintUsesIssuerSecret(): boolean {
  return resolvedLiveKitIssuerSecret.length > 0;
}

/**
 * Voice/video calls. Android uses a lighter publisher preset + H.264 + no simulcast to
 * avoid native WebRTC/MediaCodec crashes seen with VP8 multi-encoding on some devices.
 */
export function getLiveKitRoomCallOptions(): Partial<RoomOptions> {
  const isAndroid = Platform.OS === 'android';

  return {
    adaptiveStream: true,
    /** Dynacast + simulcast increases native encoder paths; disable on Android for stability. */
    dynacast: !isAndroid,
    disconnectOnPageLeave: false,
    audioCaptureDefaults: {
      echoCancellation: true,
      noiseSuppression: true,
    },
    videoCaptureDefaults: {
      /** Android: start at h180 bitrate — reduces encoder load during connect (crash mitigation). */
      resolution: isAndroid
        ? VideoPresets.h180.resolution
        : VideoPresets.h540.resolution,
      frameRate: isAndroid ? 15 : 24,
    },
    publishDefaults: {
      simulcast: !isAndroid,
      /** HW encoder path on many Android devices — fewer VP8 SVC edge-case crashes than VP8+simulcast. */
      videoCodec: isAndroid ? 'h264' : undefined,
      degradationPreference: 'maintain-framerate',
    },
    reconnectPolicy: {
      nextRetryDelayInMs: ({ retryCount }) =>
        Math.min(20_000, 500 * 2 ** Math.min(retryCount, 8)),
    },
  };
}

/** @deprecated Prefer `getLiveKitRoomCallOptions()` if you need a fresh read after JS reload. */
export const liveKitRoomCallOptions: Partial<RoomOptions> =
  getLiveKitRoomCallOptions();

export const liveKitRoomConnectOptions: Partial<RoomConnectOptions> = {
  autoSubscribe: true,
  /** More join retries when the handset is briefly offline (WhatsApp-class cafés). */
  maxRetries: 24,
  peerConnectionTimeout: 90_000,
  websocketTimeout: 45_000,
};
