import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { HopenityPersistedUserBlob } from '../../../services/hopenitySharedAuth';
import { readPersistedHopenityUser } from '../../../services/hopenitySharedAuth';
import { normalizeHopenityPersistedBlob } from '../../../services/hopenitySessionNormalize';

export type HopenityProfile = {
  displayName: string;
  avatarUrl: string | null;
  userId: string;
};

type AuthState = {
  token: string | null;
  hopenityBlob: HopenityPersistedUserBlob | null;
  profile: HopenityProfile | null;
  giftedChatUser: { _id: string | number; name: string };
};

const fallbackUser = { _id: 'me', name: 'You' } as const;

/**
 * Read MMKV synchronously before the first render so Redux starts with
 * `loggedIn = true` when a valid Hopenity session already exists.
 * This eliminates the LoginScreen flash entirely — the app opens directly
 * into the chat list without any intermediate auth screen.
 */
function buildInitialState(): AuthState {
  const empty: AuthState = {
    token: null,
    hopenityBlob: null,
    profile: null,
    giftedChatUser: fallbackUser,
  };
  try {
    const raw = readPersistedHopenityUser();
    const blob = normalizeHopenityPersistedBlob(raw);
    if (!blob?.token || blob.token.trim().length < 36) return empty;
    // Reuse the same derivation logic that setHopenitySession uses below.
    const hasToken = typeof blob.token === 'string' && blob.token.length > 0;
    const hasUser = !!blob.user && typeof blob.user === 'object';
    if (!hasToken && !hasUser) return empty;

    const u = blob.user as Record<string, unknown> | undefined;
    let displayName = 'Signed in with Hopenity';
    let avatarUrl: string | null = null;
    let userId = 'me';
    if (u) {
      displayName =
        (typeof u.name === 'string' && u.name.length > 0 ? u.name : null) ??
        (typeof u.username === 'string' && u.username.length > 0 ? u.username : null) ??
        'Hopenity friend';
      avatarUrl = (u.profile_image ?? u.profile_photo ?? u.avatar ?? u.photo ?? u.image ?? null) as string | null;
      const idRaw = u.user_id ?? u.userId ?? u.id ?? u._id;
      userId = idRaw != null && String(idRaw).length > 0 ? String(idRaw) : 'me';
    }
    return {
      token: blob.token ?? null,
      hopenityBlob: blob,
      profile: { displayName, avatarUrl, userId },
      giftedChatUser: { _id: userId, name: displayName },
    };
  } catch {
    return empty;
  }
}

const initialState: AuthState = buildInitialState();

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setHopenitySession(
      state,
      action: PayloadAction<{
        blob: HopenityPersistedUserBlob | null;
      }>,
    ) {
      const blob = normalizeHopenityPersistedBlob(action.payload.blob);

      const hasToken =
        !!blob?.token &&
        typeof blob.token === 'string' &&
        blob.token.length > 0;
      const hasUser = !!blob?.user && typeof blob.user === 'object';

      if (!blob || (!hasToken && !hasUser)) {
        state.token = null;
        state.hopenityBlob = null;
        state.profile = null;
        state.giftedChatUser = fallbackUser;
        return;
      }

      state.hopenityBlob = blob;
      state.token = hasToken ? blob.token ?? null : null;

      const u = blob.user;
      let displayName = 'Signed in with Hopenity';
      let avatarUrl: string | null = null;
      let userId = 'me';

      if (hasUser && u && typeof u === 'object') {
        const nu = u as {
          user_id?: string | number;
          userId?: string | number;
          id?: string | number;
          _id?: string | number;
          name?: string;
          username?: string;
          profile_image?: string;
          profile_photo?: string;
          avatar?: string;
        };
        displayName =
          (typeof nu.name === 'string' && nu.name.length > 0
            ? nu.name
            : null) ??
          (typeof nu.username === 'string' && nu.username.length > 0
            ? nu.username
            : null) ??
          'Hopenity friend';
        avatarUrl =
          (nu.profile_image ??
            nu.profile_photo ??
            nu.avatar ??
            (nu as { photo?: string }).photo ??
            (nu as { image?: string }).image ??
            null) as string | null;
        const idRaw = nu.user_id ?? nu.userId ?? nu.id ?? nu._id;
        userId =
          idRaw != null && String(idRaw).length > 0 ? String(idRaw) : 'me';
      }

      state.profile = {
        displayName,
        avatarUrl,
        userId,
      };
      state.giftedChatUser = {
        _id: userId,
        name: displayName,
      };
    },
    clearAuth() {
      return initialState;
    },
  },
});

export const selectAuthToken = (state: { auth: AuthState }) => state.auth.token;
/** Require a bearer token so chats and API calls are consistent with a real session. */
export const selectHopeChatLoggedIn = (state: { auth: AuthState }) =>
  !!(state.auth.token && String(state.auth.token).length > 0);
export const selectHopenityProfile = (state: { auth: AuthState }) =>
  state.auth.profile;

export const { setHopenitySession, clearAuth } = authSlice.actions;

export default authSlice.reducer;
