/**
 * Reads keys from `.env` at **bundle** time (`react-native-dotenv` → `@env`).
 * Copy `.env.example` → `.env` and fill values. Restart Metro after edits.
 *
 * `.env` is gitignored. Do not commit secrets.
 */

import {
  API_BASE_URL as E_API_BASE_URL,
  LIVEKIT_ANDROID_PUBLISH_VIDEO as E_LIVEKIT_ANDROID_PUBLISH_VIDEO,
  LIVEKIT_API_KEY as E_LIVEKIT_API_KEY,
  LIVEKIT_API_SECRET as E_LIVEKIT_API_SECRET,
  LIVEKIT_DEV_TOKEN as E_LIVEKIT_DEV_TOKEN,
  LIVEKIT_ISSUER_SECRET as E_LIVEKIT_ISSUER_SECRET,
  LIVEKIT_TOKEN_SERVICE_URL as E_LIVEKIT_TOKEN_SERVICE_URL,
  LIVEKIT_URL as E_LIVEKIT_URL,
  LIVEKIT_WS_URL as E_LIVEKIT_WS_URL,
} from '@env';

function trim(v: string | undefined): string {
  return typeof v === 'string' ? v.trim() : '';
}

export const API_BASE_URL =
  trim(E_API_BASE_URL) || 'https://api.hopenity.com';

export const LIVEKIT_URL =
  trim(E_LIVEKIT_URL) || 'https://livekit.hopenity.com';

export const LIVEKIT_API_KEY = trim(E_LIVEKIT_API_KEY);

export const LIVEKIT_API_SECRET = trim(E_LIVEKIT_API_SECRET);

/** Same base as LIVEKIT unless you override in `.env`. */
export const LIVEKIT_TOKEN_SERVICE_URL =
  trim(E_LIVEKIT_TOKEN_SERVICE_URL) || LIVEKIT_URL;

/** Header for `POST …/v1/livekit/token` — falls back to LIVEKIT_API_SECRET. */
export const LIVEKIT_ISSUER_SECRET =
  trim(E_LIVEKIT_ISSUER_SECRET) || LIVEKIT_API_SECRET;

export const LIVEKIT_WS_URL = trim(E_LIVEKIT_WS_URL);

/** Dev bypass only — omit in production. */
export const LIVEKIT_DEV_TOKEN = trim(E_LIVEKIT_DEV_TOKEN);

/**
 * Android: publishing camera on LiveKit connect can crash some OEM WebRTC stacks.
 * Set `LIVEKIT_ANDROID_PUBLISH_VIDEO=true` in `.env` to opt in after validating devices.
 */
export function liveKitAndroidPublishVideoEnabled(): boolean {
  const v = trim(E_LIVEKIT_ANDROID_PUBLISH_VIDEO).toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}
