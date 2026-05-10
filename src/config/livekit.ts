/**
 * LiveKit env comes from `@env`; release builds fall back to the OSS VPS host below when unset.
 */

import {
  LIVEKIT_WS_URL,
  LIVEKIT_TOKEN_SERVICE_URL,
  LIVEKIT_ISSUER_SECRET,
  LIVEKIT_DEV_TOKEN,
} from '@env';

/** Self-hosted stack — DNS A/AAAA → LiveKit VPS, TLS via Nginx. */
export const LIVEKIT_DEFAULT_HOSTNAME = 'livekit.hopenity.com';

const trim = (v: string | undefined) => (typeof v === 'string' ? v.trim() : '');

const DEFAULT_RELEASE_WSS = `wss://${LIVEKIT_DEFAULT_HOSTNAME}`;
const DEFAULT_RELEASE_MINT_BASE = `https://${LIVEKIT_DEFAULT_HOSTNAME}`;

/** Used when LIVEKIT_DEV_TOKEN is set — must be ws(s): for physical devices use LAN/VPS URLs, not localhost. */
export const resolvedLiveKitWsUrl =
  trim(LIVEKIT_WS_URL) ||
  (__DEV__ ? 'ws://127.0.0.1:7880' : DEFAULT_RELEASE_WSS);

/** JWT mint base — same hostname as signaling in repo Nginx (`POST /v1/livekit/token`). */
export const resolvedLiveKitTokenBaseUrl =
  trim(LIVEKIT_TOKEN_SERVICE_URL) || (__DEV__ ? '' : DEFAULT_RELEASE_MINT_BASE);

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
