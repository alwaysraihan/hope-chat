/**
 * performLogout — shared logout logic for MenuScreen and SettingsScreen.
 *
 * What it does:
 *  1. Ends any active LiveKit call so native WebRTC cleans up before the
 *     screens that own the call unmount.
 *  2. Unregisters this device's FCM token so the account stops receiving
 *     calls and message previews here after logout.
 *  3. Clears the auto-login ack flag so the next cold start shows
 *     "Continue as {name}" (the first-time confirmation) again.
 *  4. Dispatches clearAuth() — App.tsx's auth gate flips the NavigationContainer
 *     key from 'hopechat-session' → 'hopechat-guest', which:
 *       • unmounts ChatsProvider, IncomingCallListener, and RootNavigator
 *       • mounts PublicStackNavigator (LoginScreen)
 *     all in a single React reconciliation batch with no manual navigation calls.
 *
 * The persisted Hopenity user blob (name, avatar) is left intact so the
 * LoginScreen can still show "Continue as {name}" — the user just needs to
 * tap it once to confirm they want to log back in.
 */

import { getApp } from '@react-native-firebase/app';
import { getMessaging, getToken } from '@react-native-firebase/messaging';

import type { AppDispatch } from '../redux/store';
import { store } from '../redux/store';
import { logOut } from '../redux/features/auth/authSlice';
import { clearAutoLoginAck } from './chatPrefs';
import { clearOfflineCacheForLogout } from './offlineCache';
import { clearAllE2eeData } from './e2ee/sessionStore';
import { clearPeerIdentities } from './e2ee/safetyNumber';
import { clearSenderKeys } from './e2ee/senderKey';
import { clearPeerBundles } from './e2ee/peerSession';
import { lockArchive } from './e2ee/archive';
import { getActiveCall } from './livekit/activeCallRegistry';
import {
  deleteFcmTokenFromHopenity,
  postFcmTokenToHopenity,
} from './registerFcmDeviceToken';

/**
 * Drop this device's FCM registration server-side. Read the auth token BEFORE
 * logOut() clears it — the request needs it, and the dispatch below is
 * synchronous. Deliberately not awaited: logout must never hang on the network,
 * and a failed unregister self-heals (the next login on this device evicts the
 * token from every other account).
 */
function unregisterFcmToken(): void {
  const apiToken = store.getState().auth.token;
  if (!apiToken) return;
  void (async () => {
    try {
      const fcm = await getToken(getMessaging(getApp()));
      if (!fcm) return;
      const r = await deleteFcmTokenFromHopenity(apiToken, fcm);
      if (!r.ok) {
        console.warn('[HopeChat] FCM token unregister failed HTTP', r.status);
      }

      // Log out, then sign straight back in on the same device and account:
      // this DELETE is async, so it can land AFTER the new session already
      // re-registered the token — silently unregistering the device the user
      // just signed into. The server scopes the delete to the OLD user id, so a
      // DIFFERENT account is never affected; only the same-account case races.
      // If a session exists by the time the delete completes, re-register now
      // rather than waiting for the next foreground.
      const currentToken = store.getState().auth.token;
      if (currentToken) {
        await postFcmTokenToHopenity(currentToken, fcm);
      }
    } catch (e) {
      console.warn('[HopeChat] FCM token unregister', e);
    }
  })();
}

export function performLogout(dispatch: AppDispatch): void {
  // 1. Close any active LiveKit call first so WebRTC cleans up before unmount.
  const activeCall = getActiveCall();
  if (activeCall) {
    activeCall.leave?.().catch(() => {});
  }

  // 2. Stop this device from ringing for the account being signed out.
  unregisterFcmToken();

  // 3. Drop this account's cached conversations, threads and previews from the
  //    device. They are keyed per user so the next account never reads them, but
  //    leaving them on disk keeps one person's chat history on a shared phone.
  clearOfflineCacheForLogout();

  // 3b. Wipe encryption state: ratchet sessions, cached plaintext and known
  //     peer identities. Leaving decrypted message bodies and live sessions on
  //     a shared device would undo the point of encrypting them.
  clearAllE2eeData();
  clearPeerIdentities();
  // Group sender keys and cached peer bundles are key material too — leaving
  // them behind on a shared device would let the next account's owner decrypt
  // the previous user's group traffic.
  clearSenderKeys();
  clearPeerBundles();
  // Drop the in-memory master key so the archive cannot be re-uploaded or read
  // under the next session.
  lockArchive();

  // 4. Clear the auto-login ack so the next cold start requires "Continue as {name}".
  clearAutoLoginAck();

  // 5. Dispatch clearAuth — App.tsx's key-change handles the full navigation
  //    transition to PublicStackNavigator / LoginScreen.
  dispatch(logOut());
}
