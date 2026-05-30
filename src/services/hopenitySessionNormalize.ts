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

/**
 * A real Hopenity JWT is a base64url(header).base64url(payload).base64url(sig) string.
 * Minimum plausible length is ~36 chars (very short JWTs don't exist in practice).
 * Using 36 instead of 12 prevents garbage strings from triggering “Continue as”.
 */
const MIN_ACCESS_TOKEN_LEN = 36;

export function hasShareableHopenityAccessToken(
  blob: HopenityPersistedUserBlob | null | undefined,
): boolean {
  const n = normalizeHopenityPersistedBlob(blob);
  const t = n?.token;
  if (typeof t !== 'string') return false;
  const trimmed = t.trim();
  if (trimmed.length < MIN_ACCESS_TOKEN_LEN) return false;
  // Structural JWT check: must have 3 dot-separated base64url segments.
  const parts = trimmed.split('.');
  return parts.length === 3 && parts[0].length >= 4 && parts[1].length >= 4;
}
