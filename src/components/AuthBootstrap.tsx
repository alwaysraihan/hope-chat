import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import {
  clearAuth,
  selectHopeChatLoggedIn,
  setHopenitySession,
} from '../redux/features/auth/authSlice';
import {
  readPersistedHopenityUser,
  subscribePersistedHopenityUser,
} from '../services/hopenitySharedAuth';
import { normalizeHopenityPersistedBlob } from '../services/hopenitySessionNormalize';
import { isAutoLoginAcked } from '../services/chatPrefs';

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Structural JWT check: 3 non-empty base64url segments, token ≥ 36 chars. */
function isStructurallyValidJwt(token: string | null | undefined): boolean {
  if (typeof token !== 'string') return false;
  const t = token.trim();
  if (t.length < 36) return false;
  const parts = t.split('.');
  return parts.length === 3 && parts[0].length >= 4 && parts[1].length >= 4;
}

/** Read, validate, and return a usable blob — or null. */
function tryReadBlob() {
  const raw = readPersistedHopenityUser();
  const blob = normalizeHopenityPersistedBlob(raw);
  if (!blob) return null;
  if (!isStructurallyValidJwt(blob.token)) return null;
  return blob;
}

// ── Component ──────────────────────────────────────────────────────────────────

/**
 * AuthBootstrap — Messenger-like session synchronisation.
 *
 * Behaviour:
 *   • FIRST TIME: LoginScreen shows "Continue as {name}" — user must tap once.
 *     The tap calls markAutoLoginAcked() so every subsequent cold-start skips
 *     the login screen entirely.
 *   • AFTER ACK: cold-start auto-logins directly to the chat list.
 *   • LOGOUT: clearAutoLoginAck() is called → next cold-start shows the
 *     "Continue as {name}" card again.
 *   • If Hopenity's token is revoked / expired, HopeChat logs out in real time.
 *
 * Sync mechanisms:
 *   iOS    — App Group shared MMKV + NSDistributedNotificationCenter (real-time).
 *   Android — ContentProvider query (instant read) + AppState foreground listener
 *             (cross-process — catches Hopenity login/logout/token-refresh while
 *             HopeChat was backgrounded). MMKV within-process listener covers
 *             deep-link auth writes in the same process.
 */
const AuthBootstrap = () => {
  const dispatch = useAppDispatch();
  const loggedIn = useAppSelector(selectHopeChatLoggedIn);

  // ── Cold-start auto-login ──────────────────────────────────────────────────
  // Runs exactly once on mount.
  // Only auto-logins if the user has already confirmed "Continue as {name}"
  // at least once.  First-time users see LoginScreen where they tap the button;
  // that tap calls markAutoLoginAcked() so every subsequent start is instant.
  useEffect(() => {
    if (loggedIn) return;
    if (!isAutoLoginAcked()) return; // first time — let LoginScreen show the confirmation
    const blob = tryReadBlob();
    if (blob) dispatch(setHopenitySession({ blob }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount only — explicit logout stays logged-out until next foreground or restart

  // ── Live-sync while signed in ──────────────────────────────────────────────
  // iOS:     NSDistributedNotificationCenter fires the moment Hopenity writes
  //          the shared MMKV key — token refreshes and Hopenity logouts propagate
  //          to HopeChat instantly, even while both apps are in the foreground.
  // Android: fires only within-process (deep-link auth writes).  Cross-process
  //          sync is handled by the AppState listener below.
  useEffect(() => {
    if (!loggedIn) return undefined;
    return subscribePersistedHopenityUser(raw => {
      const blob = normalizeHopenityPersistedBlob(raw);
      const hasToken =
        !!blob?.token &&
        typeof blob.token === 'string' &&
        blob.token.trim().length > 0;
      if (!hasToken) {
        dispatch(clearAuth());
        return;
      }
      dispatch(setHopenitySession({ blob }));
    });
  }, [loggedIn, dispatch]);

  // ── Live auto-login while on LoginScreen ──────────────────────────────────
  // Handles the case where HopeChat's LoginScreen is open and Hopenity logs in.
  // iOS: real-time via NSDistributedNotificationCenter.
  // Android: fires on deep-link writes; AppState covers the foreground path.
  useEffect(() => {
    if (loggedIn) return undefined;
    return subscribePersistedHopenityUser(raw => {
      const blob = normalizeHopenityPersistedBlob(raw);
      if (!isStructurallyValidJwt(blob?.token)) return;
      dispatch(setHopenitySession({ blob: blob! }));
    });
  }, [loggedIn, dispatch]);

  // ── Android foreground sync ────────────────────────────────────────────────
  // On Android, MMKV's addOnValueChangedListener only fires within the same
  // process.  When the user switches from Hopenity back to HopeChat, re-read
  // the ContentProvider so cross-process changes (Hopenity login, logout, token
  // refresh) propagate instantly — no restart needed.
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const sub = AppState.addEventListener('change', nextState => {
      if (nextState !== 'active') return;
      // AppState.addEventListener only fires on CHANGES (background→foreground),
      // not on the initial 'active' state at mount — so no guard needed.
      const blob = tryReadBlob();
      const hasFreshToken = blob !== null;

      if (loggedIn && !hasFreshToken) {
        // Hopenity logged out or token expired while HopeChat was backgrounded.
        dispatch(clearAuth());
      } else if (!loggedIn && hasFreshToken && isAutoLoginAcked()) {
        // Hopenity is logged in AND user has already confirmed once — restore
        // the session immediately when they foreground back to HopeChat.
        // If the user explicitly logged out (ack cleared), we do NOT auto-login
        // here — they need to go to LoginScreen and confirm again.
        dispatch(setHopenitySession({ blob: blob! }));
      }
      // "still logged in" — no action needed.  iOS token refreshes propagate
      // via the NSDistributedNotificationCenter live-sync subscription above.
      // Android token refreshes are caught by API 401 → clearAuth() → re-login.
    });

    return () => sub.remove();
  // Re-register when loggedIn changes so the closure captures the current value.
  }, [loggedIn, dispatch]);

  return null;
};

export default AuthBootstrap;
