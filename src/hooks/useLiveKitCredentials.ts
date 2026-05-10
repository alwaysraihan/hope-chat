import { useCallback, useEffect, useState } from 'react';

import {
  LIVEKIT_FALLBACK_ROOM,
  liveKitDevBypassEnabled,
  liveKitMintConfigured,
  liveKitMintUsesIssuerSecret,
  resolvedLiveKitDevToken,
  resolvedLiveKitIssuerSecret,
  resolvedLiveKitTokenBaseUrl,
  resolvedLiveKitWsUrl,
} from '../config/livekit';
import { mintLiveKitToken } from '../services/mintLivekitToken';

function devWsValid(): boolean {
  const u = resolvedLiveKitWsUrl;
  return u.startsWith('ws://') || u.startsWith('wss://');
}

function isAbortError(e: unknown): boolean {
  return (
    e instanceof Error &&
    (e.name === 'AbortError' || e.message === 'Aborted')
  );
}

export type UseLiveKitCredentialsResult = {
  loading: boolean;
  serverUrl: string | null;
  token: string | null;
  error: string | null;
  errorCode: string | null;
  reload: () => void;
};

/**
 * Loads LiveKit JWT + signaling URL via `.env`:
 * production: HTTPS token issuer mint; optional dev bypass with LIVEKIT_DEV_TOKEN + LIVEKIT_WS_URL.
 */
export function useLiveKitCredentials(options: {
  room?: string | null;
  identity?: string | null;
  displayName?: string | null;
}): UseLiveKitCredentialsResult {
  const room =
    typeof options.room === 'string' && options.room.trim().length > 0
      ? options.room.trim().slice(0, 128)
      : LIVEKIT_FALLBACK_ROOM;
  const identity =
    typeof options.identity === 'string' && options.identity.trim().length > 0
      ? options.identity.trim().slice(0, 128)
      : undefined;
  const name =
    typeof options.displayName === 'string' && options.displayName.trim().length > 0
      ? options.displayName.trim().slice(0, 128)
      : undefined;

  const [nonce, setNonce] = useState(0);
  const [loading, setLoading] = useState(true);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  const fetchWithMint = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      setError(null);
      setErrorCode(null);

      try {
        const minted = await mintLiveKitToken({
          baseUrl: resolvedLiveKitTokenBaseUrl,
          issuerSecret: liveKitMintUsesIssuerSecret()
            ? resolvedLiveKitIssuerSecret
            : undefined,
          room,
          identity,
          name,
          ttlSeconds: 3600,
          signal,
        });

        if (signal.aborted) {
          return;
        }

        const ws =
          minted.url && minted.url.length > 0 ? minted.url : resolvedLiveKitWsUrl;

        setServerUrl(ws);
        setToken(minted.token);
      } catch (raw) {
        if (signal.aborted || isAbortError(raw)) {
          return;
        }
        const code = raw instanceof Error ? raw.message : 'token_mint_failed';
        setServerUrl(null);
        setToken(null);
        setErrorCode(code);
        setError(
          code === 'unauthorized'
            ? 'Issuer secret mismatch — set LIVEKIT_ISSUER_SECRET to match VPS TOKEN_ISSUER_SECRET.'
            : 'Could not mint a LiveKit token. Retry or verify LIVEKIT_TOKEN_SERVICE_URL (e.g. https://livekit.hopenity.com).',
        );
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    },
    [room, identity, name],
  );

  useEffect(() => {
    const ac = new AbortController();
    const { signal } = ac;

    const run = async () => {
      if (liveKitDevBypassEnabled()) {
        setLoading(false);
        if (!devWsValid()) {
          setServerUrl(null);
          setToken(null);
          setErrorCode('bad_ws_url');
          setError(
            'Set LIVEKIT_WS_URL to a reachable ws(s) address (physical devices cannot use 127.0.0.1 of your laptop).',
          );
          return;
        }

        setError(null);
        setErrorCode(null);
        setServerUrl(resolvedLiveKitWsUrl);
        setToken(resolvedLiveKitDevToken);
        return;
      }

      if (!liveKitMintConfigured()) {
        setLoading(false);
        setServerUrl(null);
        setToken(null);
        setErrorCode('mint_not_configured');
        setError(
          'Set LIVEKIT_TOKEN_SERVICE_URL in `.env` (e.g. https://livekit.hopenity.com), or LIVEKIT_DEV_TOKEN for CLI tokens.',
        );
        return;
      }

      await fetchWithMint(signal);
    };

    run().catch(() => undefined);

    return () => ac.abort();
  }, [room, identity, name, nonce, fetchWithMint]);

  return {
    loading,
    serverUrl,
    token,
    error,
    errorCode,
    reload,
  };
}
