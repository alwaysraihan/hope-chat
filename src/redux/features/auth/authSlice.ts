import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { HopenityPersistedUserBlob } from '../../../services/hopenitySharedAuth';
import { normalizeHopenityPersistedBlob } from '../../../services/hopenitySessionNormalize';
import type { OwnedPage } from '../../../services/pageService';

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
  /** Non-null when the user is chatting as one of their pages. */
  activePage: OwnedPage | null;
};

const fallbackUser = { _id: 'me', name: 'You' } as const;

// Always start with an empty session. Reading MMKV at module-evaluation time
// (before the React Native bridge is ready) crashes on Android because the
// native MMKV module isn't initialized yet.
// AuthBootstrap handles session loading safely inside useEffect — after the
// bridge is fully set up — then dispatches setHopenitySession() to hydrate.
const initialState: AuthState = {
  token: null,
  hopenityBlob: null,
  profile: null,
  giftedChatUser: fallbackUser,
  activePage: null,
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
    setActivePage(state, action: PayloadAction<OwnedPage | null>) {
      state.activePage = action.payload;
    },
    /**
     * Explicit user-initiated logout.
     * Clears the token + activePage but keeps hopenityBlob + profile so the
     * LoginScreen's "Continue as {name}" card appears immediately on the same
     * session without waiting for AuthBootstrap to re-read MMKV.
     */
    logOut(state) {
      state.token = null;
      state.activePage = null;
      // hopenityBlob and profile are intentionally preserved
    },
    clearAuth() {
      return initialState;
    },
  },
});

export const selectAuthToken = (state: { auth: AuthState }) => state.auth.token;
export const selectActivePage = (state: { auth: AuthState }) => state.auth.activePage;
/** Require a bearer token so chats and API calls are consistent with a real session. */
export const selectHopeChatLoggedIn = (state: { auth: AuthState }) =>
  !!(state.auth.token && String(state.auth.token).length > 0);
export const selectHopenityProfile = (state: { auth: AuthState }) =>
  state.auth.profile;

export const { setHopenitySession, clearAuth, logOut, setActivePage } = authSlice.actions;

export default authSlice.reducer;
