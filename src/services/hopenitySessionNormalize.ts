import type { HopenityPersistedUserBlob } from './hopenitySharedAuth';

/**
 * Align Hope Chat with Hopenity MMKV + login API shapes: pick the first usable
 * access token, trim, strip a duplicated `Bearer ` prefix, and drop empties.
 */
export function normalizeHopenityPersistedBlob(
  blob: HopenityPersistedUserBlob | null | undefined,
): HopenityPersistedUserBlob | null {
  if (!blob || typeof blob !== 'object') return null;

  const r = blob as Record<string, unknown>;
  const raw =
    r.token ??
    r.accessToken ??
    r.access_token ??
    r.jwt ??
    null;

  let s =
    raw == null
      ? ''
      : typeof raw === 'string'
        ? raw.trim()
        : String(raw).trim();

  s = s.replace(/^bearer\s+/i, '').trim();

  const next: HopenityPersistedUserBlob = { ...blob };
  if (s.length > 0) {
    next.token = s;
  } else {
    delete next.token;
  }

  return next;
}

/** Ignore empty / whitespace / ultra-short garbage so the login card does not flash “Continue as”. */
const MIN_ACCESS_TOKEN_LEN = 12;

export function hasShareableHopenityAccessToken(
  blob: HopenityPersistedUserBlob | null | undefined,
): boolean {
  const n = normalizeHopenityPersistedBlob(blob);
  const t = n?.token;
  return typeof t === 'string' && t.trim().length >= MIN_ACCESS_TOKEN_LEN;
}
