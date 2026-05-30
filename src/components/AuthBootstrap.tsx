import React, { useEffect } from 'react';
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

/**
 * Handles two jobs:
 *
 * 1. Cold-start auto-login: if the user previously confirmed "Continue as {name}",
 *    restore their session from MMKV immediately so the login screen is never shown
 *    again until they explicitly log out.
 *
 * 2. Live-sync: while the user is logged in, keep Redux in sync whenever the
 *    shared Hopenity MMKV vault updates (token refresh, re-login in partner app).
 */
const AuthBootstrap = () => {
  const dispatch = useAppDispatch();
  const loggedIn = useAppSelector(selectHopeChatLoggedIn);

  // ── Cold-start auto-login ──────────────────────────────────────────────────
  // Runs exactly once on mount.
  //
  // Session sources:
  //   iOS:     App Group shared MMKV — same encrypted file Hopenity wrote to.
  //            Works instantly on any cold-start, no deep-link required.
  //   Android: HopeChat's private MMKV, seeded by the deep-link handshake
  //            (hopechat://auth?token=...) the first time user opens from Hopenity.
  //
  // If `isAutoLoginAcked()` (user previously confirmed "Continue as {name}"):
  //   → dispatch silently — login screen never shown (Messenger-like behaviour)
  // Otherwise:
  //   → LoginScreen shows "Continue as {name}" card — user confirms once
  //
  // Token validation: structural JWT check only (no network). The first
  // authenticated API call in ChatsContext validates server-side; 401 → clearAuth().
  useEffect(() => {
    if (loggedIn) return;

    const raw = readPersistedHopenityUser();
    const blob = normalizeHopenityPersistedBlob(raw);
    if (!blob) return;

    const token = blob.token;
    if (typeof token !== 'string' || token.trim().length < 36) return;

    // Structural JWT guard: 3 non-empty base64url segments.
    const parts = token.trim().split('.');
    if (parts.length !== 3 || parts[0].length < 4 || parts[1].length < 4) return;

    if (!isAutoLoginAcked()) {
      // Session available but not yet confirmed — LoginScreen will show the
      // "Continue as {name}" card. Don't dispatch here; let the user tap once.
      return;
    }

    // Previously confirmed — log in immediately without any UI flicker.
    dispatch(setHopenitySession({ blob }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — must run only on mount

  // ── Live-sync while signed in ──────────────────────────────────────────────
  // Mirrors Hopenity MMKV changes into Redux so a token refresh or cross-app
  // sign-out propagates without a restart.
  // iOS: fires via NSDistributedNotificationCenter when Hopenity writes/deletes.
  // Android: fires only within the same process (deep-link writes).
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
  // Handles the scenario where HopeChat's LoginScreen is open and Hopenity
  // logs in during the same device session (iOS App Groups: real-time via
  // NSDistributedNotificationCenter).
  //
  // If the user has previously confirmed "Continue as {name}" (isAutoLoginAcked),
  // skip straight to the app — no tap needed. This is the Messenger experience:
  // open Messenger immediately after logging into Facebook and you're already in.
  useEffect(() => {
    if (loggedIn) return undefined; // already handled by the live-sync effect above
    return subscribePersistedHopenityUser(raw => {
      const blob = normalizeHopenityPersistedBlob(raw);
      if (!blob?.token) return;
      const t = blob.token.trim();
      if (t.length < 36) return;
      const parts = t.split('.');
      if (parts.length !== 3 || parts[0].length < 4 || parts[1].length < 4) return;
      if (!isAutoLoginAcked()) return; // LoginScreen's peekSession will show the card
      // Silently log in — the NavigationContainer key change transitions to the main app.
      dispatch(setHopenitySession({ blob }));
    });
  }, [loggedIn, dispatch]);

  return null;
};

export default AuthBootstrap;
