declare module '@env' {
  export const LIVEKIT_WS_URL: string | undefined;
  export const LIVEKIT_TOKEN_SERVICE_URL: string | undefined;
  /** Optional; required only when VPS TOKEN_ISSUER_SECRET is set. */
  export const LIVEKIT_ISSUER_SECRET: string | undefined;
  /** Optional: skip mint and join with a JWT from livekit-cli (dev only). */
  export const LIVEKIT_DEV_TOKEN: string | undefined;
}
