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
  // Runs exactly once on mount. If the user has confirmed login before (acked)
  // and a valid session is persisted, dispatch immediately — the login screen
  // never becomes visible because loggedIn becomes true before React renders.
  useEffect(() => {
    if (loggedIn) return;              // already logged in (hot reload / dev)
    if (!isAutoLoginAcked()) return;   // first-time user — show the login screen

    const blob = normalizeHopenityPersistedBlob(readPersistedHopenityUser());
    const hasToken =
      !!blob?.token &&
      typeof blob.token === 'string' &&
      blob.token.trim().length > 0;

    if (!hasToken) return; // session was cleared (e.g. Hopenity signed out)

    dispatch(setHopenitySession({ blob }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — must run only on mount

  // ── Live-sync ──────────────────────────────────────────────────────────────
  // While the user is signed in, mirror Hopenity MMKV changes into Redux so
  // a token refresh or cross-app sign-out propagates without a restart.
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

  return null;
};

export default AuthBootstrap;
