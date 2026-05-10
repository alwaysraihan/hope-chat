import { useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import { useAppDispatch, useAppStore } from '../hooks/redux';
import { setHopenitySession } from '../redux/features/auth/authSlice';
import {
  readPersistedHopenityUser,
  subscribePersistedHopenityUser,
  isUsableHopenityBlob,
  type HopenityPersistedUserBlob,
} from '../services/hopenitySharedAuth';
import type { AppDispatch, AppStore } from '../redux/store';

function vaultMatchesRedux(
  blob: HopenityPersistedUserBlob | null,
  token: string | null,
  serializedBlob: string | undefined,
): boolean {
  if (!isUsableHopenityBlob(blob)) return false;
  try {
    return (
      blob.token === token &&
      serializedBlob !== undefined &&
      serializedBlob === JSON.stringify(blob)
    );
  } catch {
    return false;
  }
}

function serializeReduxBlob(hopenityBlob: unknown): string | undefined {
  try {
    return hopenityBlob != null ? JSON.stringify(hopenityBlob) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Syncs MMKV vault ↔ Redux. When the vault read is empty, **does not** clear
 * Redux immediately — MMKV listeners can fire before reads see a just-written
 * session; we defer one tick before clearing so email login isn’t wiped.
 */
function reconcileVaultWithRedux(
  dispatch: AppDispatch,
  store: AppStore,
  blob: HopenityPersistedUserBlob | null,
): void {
  const { token, hopenityBlob } = store.getState().auth;
  const serializedStored = serializeReduxBlob(hopenityBlob);

  if (isUsableHopenityBlob(blob)) {
    if (!vaultMatchesRedux(blob, token, serializedStored)) {
      dispatch(setHopenitySession({ blob }));
    }
    return;
  }

  if (!token) return;

  setTimeout(() => {
    const delayed = readPersistedHopenityUser();
    const next = store.getState().auth;
    const serializedNext = serializeReduxBlob(next.hopenityBlob);

    if (isUsableHopenityBlob(delayed)) {
      if (!vaultMatchesRedux(delayed, next.token, serializedNext)) {
        dispatch(setHopenitySession({ blob: delayed }));
      }
      return;
    }

    const t = store.getState().auth.token;
    if (t) {
      dispatch(setHopenitySession({ blob: null }));
    }
  }, 0);
}

/**
 * Restores session from encrypted shared MMKV on launch, keeps Redux aligned when
 * the vault updates in-process, and re-reads when returning from background so
 * Hopenity sessions appear without an app restart.
 */
const AuthBootstrap = () => {
  const dispatch = useAppDispatch();
  const store = useAppStore();

  const syncVaultToRedux = useCallback(() => {
    const blob = readPersistedHopenityUser();
    reconcileVaultWithRedux(dispatch, store, blob);
  }, [dispatch, store]);

  useEffect(() => {
    syncVaultToRedux();

    const unsubMm = subscribePersistedHopenityUser(blob => {
      reconcileVaultWithRedux(dispatch, store, blob);
    });

    const appSub = AppState.addEventListener('change', next => {
      if (next === 'active') {
        syncVaultToRedux();
      }
    });

    return () => {
      unsubMm();
      appSub.remove();
    };
  }, [dispatch, store, syncVaultToRedux]);

  return null;
};

export default AuthBootstrap;
