import type { HopenityPersistedUserBlob } from '../services/hopenitySharedAuth';

/**
 * Normalizes login API payloads so Redux gets a string token and user object.
 * Many backends use `accessToken` / `access_token` instead of `token`.
 */
export function extractLoginSessionBlob(
  responseData: Record<string, unknown> | null | undefined,
  fallbackName: string,
): HopenityPersistedUserBlob | null {
  if (!responseData || typeof responseData !== 'object') return null;

  const rd = responseData as Record<string, unknown>;
  const tokenRaw =
    rd.token ??
    rd.accessToken ??
    rd.access_token ??
    rd.jwt ??
    (typeof rd.data === 'object' && rd.data != null
      ? (rd.data as Record<string, unknown>).token
      : undefined);

  if (tokenRaw == null || tokenRaw === '') return null;

  const token = typeof tokenRaw === 'string' ? tokenRaw : String(tokenRaw);
  if (!token.trim()) return null;

  const user: NonNullable<HopenityPersistedUserBlob['user']> =
    rd.user && typeof rd.user === 'object'
      ? (rd.user as NonNullable<HopenityPersistedUserBlob['user']>)
      : {
          id:
            (rd.id as string | number | undefined) ??
            (rd.userId as string | number | undefined) ??
            (rd.user_id as string | number | undefined) ??
            'me',
          name:
            (typeof rd.name === 'string' ? rd.name : null) ??
            (typeof rd.username === 'string' ? rd.username : null) ??
            fallbackName,
        };

  return { token, user };
}
