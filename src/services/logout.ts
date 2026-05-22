/**
 * performLogout — shared logout logic for MenuScreen and SettingsScreen.
 *
 * What it does:
 *  1. Ends any active LiveKit call so native WebRTC cleans up before the
 *     screens that own the call unmount.
 *  2. Clears the auto-login ack so HopeChat doesn't silently restore the
 *     session on the next cold start.
 *  3. Dispatches clearAuth() — App.tsx's auth gate flips the NavigationContainer
 *     key from 'hopechat-session' → 'hopechat-guest', which:
 *       • unmounts ChatsProvider, IncomingCallListener, and RootNavigator
 *       • mounts PublicStackNavigator (LoginScreen)
 *     all in a single React reconciliation batch with no manual navigation calls.
 *
 * Why we do NOT call navigationRef.reset() here:
 *  The previous implementation called navigationRef.reset({ routes: [{ name: 'Login' }] })
 *  from MenuScreen before dispatching clearAuth().  That call attempts to remove
 *  BottomTabNavigator (MenuScreen's own parent) from the navigation state while
 *  MenuScreen is still mounted and mid-render.  React Navigation's cleanup then
 *  tries to access the (now invalid) parent navigator context → crash.
 *
 * Why we do NOT call clearPersistedHopenityUser():
 *  After logout, LoginScreen should still show the "Continue as {name}" card so
 *  the user can sign back in with one tap without having to re-open Hopenity.
 *  The persisted blob retains the display name and avatar; the still-valid token
 *  lets onContinue() validate and log them back in immediately.
 *  clearAutoLoginAck() is sufficient to prevent silent cold-start auto-login.
 */

import type { AppDispatch } from '../redux/store';
import { clearAuth } from '../redux/features/auth/authSlice';
import { clearAutoLoginAck } from './chatPrefs';
import { getActiveCall } from './livekit/activeCallRegistry';

export function performLogout(dispatch: AppDispatch): void {
  // 1. Close any active LiveKit call first.
  const activeCall = getActiveCall();
  if (activeCall) {
    activeCall.leave?.().catch(() => {});
  }

  // 2. Clear the auto-login ack so the next cold start shows LoginScreen
  //    rather than silently restoring the session.
  //    The persisted user blob (name, avatar, token) is intentionally kept so
  //    LoginScreen can show the "Continue as {name}" card immediately.
  clearAutoLoginAck();

  // 3. Dispatch clearAuth — App.tsx's key-change on NavigationContainer
  //    handles the full transition to PublicStackNavigator / LoginScreen.
  dispatch(clearAuth());
}
