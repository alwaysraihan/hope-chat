import React, { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import {
  clearAuth,
  selectHopeChatLoggedIn,
  setHopenitySession,
} from '../redux/features/auth/authSlice';
import { subscribePersistedHopenityUser } from '../services/hopenitySharedAuth';
import { normalizeHopenityPersistedBlob } from '../services/hopenitySessionNormalize';

/**
 * After the user has entered the signed-in tree, keep Redux in sync when the
 * shared Hopenity MMKV vault updates (token refresh, re-login in partner app).
 */
const AuthBootstrap = () => {
  const dispatch = useAppDispatch();
  const loggedIn = useAppSelector(selectHopeChatLoggedIn);

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
