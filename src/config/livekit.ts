/**
 * Wire these to your environment. Self-hosted LiveKit server:
 * git clone git@github.com:livekit/livekit.git && (see Dockerfile / Makefile)
 *
 * Typical local URL: ws://YOUR_LAN_IP:7880 — simulators/devices cannot use 127.0.0.1 of your Mac from device;
 * use the machine LAN address instead.
 *
 * Tokens must be JWTs minted by your backend (recommended) or the livekit-cli for dev.
 */

export const LIVEKIT_URL =
  (__DEV__
    ? 'ws://127.0.0.1:7880'
    : 'wss://your-livekit-domain.example') as string;

/** Dev-only fixed token placeholder — replace via env-specific module or secrets in real builds. */
export const LIVEKIT_DEV_TOKEN = '';

export const LIVEKIT_FALLBACK_ROOM = 'hope-chat';
