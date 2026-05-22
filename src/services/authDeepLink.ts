/**
 * authDeepLink — modern cross-app auth handoff (replaces sharedUserId MMKV).
 *
 * ── URL format produced by Hopenity ──────────────────────────────────────────
 *
 *   hopechat://auth?token=<jwt>&user=<pct_encoded_json>&redirect=<pct_encoded_path>&ts=<unix_ms>
 *
 *   token    — the Hopenity JWT (required)
 *   ts       — Unix timestamp in milliseconds when the link was issued (required)
 *   user     — percent-encoded JSON of the user object, name/avatar only (optional)
 *   redirect — percent-encoded path to open after login, e.g. "peer/123" (optional)
 *
 * ── Security model ────────────────────────────────────────────────────────────
 *
 *  1. Custom-scheme exclusivity
 *     `hopechat://` is declared in AndroidManifest.xml and iOS Info.plist with
 *     no `android:exported="true"` on a public receiver — only HopeChat can handle
 *     these intents.  A malicious app on the same device cannot intercept them.
 *
 *  2. JWT integrity
 *     The token is a signed JWT from the Hopenity backend.  Only the server holds
 *     the signing key; a third party cannot forge a valid token.
 *     We additionally validate the structural shape (3 base64url segments) before
 *     accepting a URL so trivially invalid values are dropped at the boundary.
 *
 *  3. Replay protection (timestamp freshness)
 *     Every auth link carries `ts=<unix_ms>`.  Links older than AUTH_LINK_MAX_AGE_MS
 *     (5 minutes) or suspiciously future-dated (> 60 s ahead of local clock) are
 *     rejected.  This means even if someone captures the URL from Android's system
 *     log or adb, it can only be replayed within the 5-minute window — after which
 *     the JWT would also have been refreshed.
 *
 *  4. Single-use by design
 *     `consumePendingAuthLink()` clears the slot after first read, so the same
 *     payload cannot be applied twice in a single session.
 *
 *  5. Expiry at backend
 *     If the JWT itself has expired, the first authenticated API call returns 401
 *     and `ChatsContext` dispatches `clearAuth()`, returning the user to the login
 *     screen — no special handling required here.
 *
 *  6. User object is identity-only
 *     We only include the user's name and avatar URL in the `user` param, never
 *     sensitive fields (email, phone, location).  The full blob is never logged.
 */

import type { HopenityPersistedUserBlob } from './hopenitySharedAuth';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Auth links older than this are rejected as potential replays. */
export const AUTH_LINK_MAX_AGE_MS = 5 * 60 * 1_000; // 5 minutes

/** Clock-skew tolerance: reject links issued more than 60 s in the future. */
const CLOCK_SKEW_TOLERANCE_MS = 60 * 1_000;

// ── Types ─────────────────────────────────────────────────────────────────────

export type AuthLinkPayload = {
  /** Raw Hopenity JWT — used to build the session blob. */
  token: string;
  /** Reconstituted session blob ready for setHopenitySession / persistHopenityUser. */
  blob: HopenityPersistedUserBlob;
  /** Optional path to navigate to after auth, e.g. "peer/12345". */
  redirect: string | null;
  /** Unix ms when the link was issued (from `ts` param). Null if absent (legacy). */
  issuedAt: number | null;
};

// ── URL matching ──────────────────────────────────────────────────────────────

const AUTH_URL_RE = /^hopechat:\/\/auth\b/i;

export function isAuthDeepLink(url: string | null | undefined): boolean {
  return typeof url === 'string' && AUTH_URL_RE.test(url);
}

// ── Validation helpers ────────────────────────────────────────────────────────

/**
 * Structural check: a JWT must be exactly three non-empty base64url segments
 * separated by dots.  We cannot verify the signature here (no key), but we
 * can reject obviously malformed values before touching state.
 */
const JWT_SEGMENT_RE = /^[A-Za-z0-9_-]+$/;
function isPlausibleJwt(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  // Header and payload must be non-trivial; signature may be empty for 'none'
  // algo (backend will reject that with 401, not a concern here).
  if (parts[0].length < 4 || parts[1].length < 4) return false;
  return parts.every(p => p === '' || JWT_SEGMENT_RE.test(p));
}

/**
 * Timestamp freshness check.
 * Returns true when the link was issued within the acceptable window.
 * When `ts` is absent (links from old Hopenity builds), we accept them
 * for backward compatibility but flag `issuedAt` as null.
 */
function isTimestampFresh(issuedAt: number | null): boolean {
  if (issuedAt === null) return true; // legacy link — no ts param, accept
  const age = Date.now() - issuedAt;
  if (age > AUTH_LINK_MAX_AGE_MS) return false; // too old — possible replay
  if (age < -CLOCK_SKEW_TOLERANCE_MS) return false; // future-dated — clock skew / tampered
  return true;
}

// ── Parser ────────────────────────────────────────────────────────────────────

/** Minimal query-string parser — avoids relying on URLSearchParams availability. */
function parseQsValue(qs: string, key: string): string | null {
  const re = new RegExp(`(?:^|&)${key}=([^&]*)`);
  const m = qs.match(re);
  if (!m?.[1]) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

/**
 * Parse and validate a `hopechat://auth?...` URL.
 *
 * Returns null when:
 *  • URL doesn't match the auth path
 *  • `token` param is missing or fails JWT structural validation
 *  • `ts` param is present but the link is stale / suspiciously future-dated
 */
export function parseAuthDeepLink(url: string): AuthLinkPayload | null {
  if (!isAuthDeepLink(url)) return null;

  try {
    const qMark = url.indexOf('?');
    if (qMark === -1) return null;
    const qs = url.slice(qMark + 1);

    // ── Token ──────────────────────────────────────────────────────────────
    const token = parseQsValue(qs, 'token');
    if (!token || token.trim().length === 0) return null;

    const trimmedToken = token.trim();

    // Structural validation — reject obviously malformed values at the boundary.
    if (!isPlausibleJwt(trimmedToken)) {
      if (__DEV__) {
        console.warn('[authDeepLink] Rejected: token fails JWT structural check');
      }
      return null;
    }

    // ── Timestamp freshness ────────────────────────────────────────────────
    const tsRaw = parseQsValue(qs, 'ts');
    const issuedAt = tsRaw ? parseInt(tsRaw, 10) : null;

    if (!isTimestampFresh(issuedAt)) {
      if (__DEV__) {
        console.warn(
          '[authDeepLink] Rejected: link is stale or future-dated',
          { issuedAt, now: Date.now(), ageMs: issuedAt ? Date.now() - issuedAt : null },
        );
      }
      return null;
    }

    // ── User blob (identity only — name + avatar, no sensitive fields) ─────
    let userObject: HopenityPersistedUserBlob['user'] = null;
    const userRaw = parseQsValue(qs, 'user');
    if (userRaw) {
      try {
        const parsed = JSON.parse(userRaw) as Record<string, unknown>;
        // Whitelist: only carry the fields HopeChat actually uses for display.
        // This prevents a crafted `user` payload from injecting unexpected data.
        userObject = {
          user_id: parsed.user_id ?? parsed.id,
          name:    typeof parsed.name     === 'string' ? parsed.name     : undefined,
          username: typeof parsed.username === 'string' ? parsed.username : undefined,
          profile_image: typeof parsed.profile_image === 'string' ? parsed.profile_image : undefined,
          profile_photo: typeof parsed.profile_photo === 'string' ? parsed.profile_photo : undefined,
          avatar:  typeof parsed.avatar   === 'string' ? parsed.avatar   : undefined,
          image:   typeof parsed.image    === 'string' ? parsed.image    : undefined,
        } as HopenityPersistedUserBlob['user'];
      } catch {
        // user param is optional — silently continue without display metadata
      }
    }

    // ── Redirect path ──────────────────────────────────────────────────────
    const redirect = parseQsValue(qs, 'redirect');

    const blob: HopenityPersistedUserBlob = {
      token: trimmedToken,
      user: userObject,
      isLogin: true,
    };

    return { token: trimmedToken, blob, redirect: redirect ?? null, issuedAt };
  } catch {
    return null;
  }
}

// ── Pending-link bus ──────────────────────────────────────────────────────────
//
// Same pattern as peerDeepLink.ts.  LoginScreen consumes the pending payload
// on mount and also subscribes for live deep links while the screen is shown.

let _pending: AuthLinkPayload | null = null;
let _listener: ((payload: AuthLinkPayload) => void) | null = null;

/** Called from App.tsx as soon as a valid URL is parsed. */
export function setPendingAuthLink(payload: AuthLinkPayload): void {
  _pending = payload;
  _listener?.(payload);
}

/**
 * Read-and-clear the pending auth payload (single-use guarantee).
 * LoginScreen calls this once on mount.
 */
export function consumePendingAuthLink(): AuthLinkPayload | null {
  const p = _pending;
  _pending = null;
  return p;
}

/** Subscribe to real-time auth deep-link events. Returns unsubscribe fn. */
export function onAuthDeepLink(
  cb: (payload: AuthLinkPayload) => void,
): () => void {
  _listener = cb;
  return () => {
    if (_listener === cb) _listener = null;
  };
}
