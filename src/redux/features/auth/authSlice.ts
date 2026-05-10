import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { HopenityPersistedUserBlob } from '../../../services/hopenitySharedAuth';

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

const initialState: AuthState = {
  token: null,
  hopenityBlob: null,
  profile: null,
  giftedChatUser: fallbackUser,
};

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
      const { blob } = action.payload;

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
            null) as string | null;
        const idRaw = nu.id ?? nu._id;
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
