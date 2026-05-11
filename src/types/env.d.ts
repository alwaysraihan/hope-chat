declare module '@env' {
  /** Hopenity API origin, e.g. https://api.hopenity.com */
  export const API_BASE_URL: string;
  /** LiveKit stack HTTPS origin (token mint + inferred wss when LIVEKIT_WS_URL is empty). */
  export const LIVEKIT_URL: string;
  export const LIVEKIT_API_KEY: string;
  export const LIVEKIT_API_SECRET: string;
  /** Optional override; defaults to LIVEKIT_URL when empty. */
  export const LIVEKIT_TOKEN_SERVICE_URL: string;
  /** Optional; defaults to LIVEKIT_API_SECRET when empty. */
  export const LIVEKIT_ISSUER_SECRET: string;
  /** Optional ws(s) override; empty = derived from LIVEKIT_URL in livekit.ts. */
  export const LIVEKIT_WS_URL: string;
  /** Dev only: fixed JWT from livekit-cli; leave empty in release. */
  export const LIVEKIT_DEV_TOKEN: string;
  /**
   * Android only: set `true` to let LiveKit publish camera on connect (default off — crash mitigation).
   */
  export const LIVEKIT_ANDROID_PUBLISH_VIDEO: string;
}
