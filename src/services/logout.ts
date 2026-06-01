/**
 * performLogout — shared logout logic for MenuScreen and SettingsScreen.
 *
 * What it does:
 *  1. Ends any active LiveKit call so native WebRTC cleans up before the
 *     screens that own the call unmount.
 *  2. Clears the auto-login ack flag so the next cold start shows
 *     "Continue as {name}" (the first-time confirmation) again.
 *  3. Dispatches clearAuth() — App.tsx's auth gate flips the NavigationContainer
 *     key from 'hopechat-session' → 'hopechat-guest', which:
 *       • unmounts ChatsProvider, IncomingCallListener, and RootNavigator
 *       • mounts PublicStackNavigator (LoginScreen)
 *     all in a single React reconciliation batch with no manual navigation calls.
 *
 * The persisted Hopenity user blob (name, avatar) is left intact so the
 * LoginScreen can still show "Continue as {name}" — the user just needs to
 * tap it once to confirm they want to log back in.
 */

import type { AppDispatch } from '../redux/store';
import { clearAuth } from '../redux/features/auth/authSlice';
import { clearAutoLoginAck } from './chatPrefs';
import { getActiveCall } from './livekit/activeCallRegistry';

export function performLogout(dispatch: AppDispatch): void {
  // 1. Close any active LiveKit call first so WebRTC cleans up before unmount.
  const activeCall = getActiveCall();
  if (activeCall) {
    activeCall.leave?.().catch(() => {});
  }

  // 2. Clear the auto-login ack so the next cold start requires "Continue as {name}".
  clearAutoLoginAck();

  // 3. Dispatch clearAuth — App.tsx's key-change handles the full navigation
  //    transition to PublicStackNavigator / LoginScreen.
  dispatch(clearAuth());
}
