export type MintLiveKitTokenOk = {
  url: string;
  token: string;
  ttlSeconds?: number;
  room?: string;
};

export type MintLiveKitTokenParams = {
  baseUrl: string;
  /** If set (must match VPS TOKEN_ISSUER_SECRET), sent as X-Hopechat-LiveKit-Secret. */
  issuerSecret?: string;
  room: string;
  identity?: string;
  name?: string;
  ttlSeconds?: number;
  signal?: AbortSignal;
};

/** POST /v1/livekit/token against your VPS (e.g. https://livekit.hopenity.com). */
export async function mintLiveKitToken({
  baseUrl,
  issuerSecret,
  room,
  identity,
  name,
  ttlSeconds = 3600,
  signal,
}: MintLiveKitTokenParams): Promise<MintLiveKitTokenOk> {
  const trimmed = baseUrl.replace(/\/+$/, '');
  const url = `${trimmed}/v1/livekit/token`;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  const secret =
    typeof issuerSecret === 'string' && issuerSecret.trim().length > 0
      ? issuerSecret.trim()
      : '';
  if (secret.length > 0) {
    headers['x-hopechat-livekit-secret'] = secret;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        room,
        identity,
        name,
        ttlSeconds,
      }),
      signal,
    });
  } catch (e) {
    const net =
      e instanceof TypeError ? e.message : 'network_unreachable';
    throw new Error(`network: ${net}`);
  }

  const body = (await res.json().catch(() => null)) as
    | { ok?: boolean; token?: unknown; url?: unknown; ttlSeconds?: number; room?: string; error?: string }
    | null;

  const token = typeof body?.token === 'string' ? body.token : '';
  const wsUrl = typeof body?.url === 'string' ? body.url : '';

  if (!res.ok || !body?.ok || !token.length || !wsUrl.startsWith('ws')) {
    const errMsg =
      typeof body?.error === 'string' && body.error.length > 0
        ? body.error
        : 'token_mint_failed';
    throw new Error(errMsg);
  }

  return {
    url: wsUrl,
    token,
    ttlSeconds: typeof body?.ttlSeconds === 'number' ? body.ttlSeconds : undefined,
    room: typeof body?.room === 'string' ? body.room : undefined,
  };
}
