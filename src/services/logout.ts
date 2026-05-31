/**
 * performLogout — shared logout logic for MenuScreen and SettingsScreen.
 *
 * What it does:
 *  1. Ends any active LiveKit call so native WebRTC cleans up before the
 *     screens that own the call unmount.
 *  2. Dispatches clearAuth() — App.tsx's auth gate flips the NavigationContainer
 *     key from 'hopechat-session' → 'hopechat-guest', which:
 *       • unmounts ChatsProvider, IncomingCallListener, and RootNavigator
 *       • mounts PublicStackNavigator (LoginScreen)
 *     all in a single React reconciliation batch with no manual navigation calls.
 *
 * Session persistence after logout:
 *  The persisted Hopenity user blob (name, avatar, token) is intentionally kept
 *  so HopeChat can restore the session on the next cold start or when the user
 *  foregrounds from Hopenity — exactly like opening Messenger after Facebook
 *  is still logged in.  No "Continue as {name}" tap is required after the first
 *  link; the session is always in sync with Hopenity.
 *
 * Why we do NOT call navigationRef.reset() here:
 *  The previous implementation called navigationRef.reset() before dispatching
 *  clearAuth(). That tries to remove BottomTabNavigator from the navigation state
 *  while the screen is still mounted → React Navigation crashes.
 *  The NavigationContainer key-change in App.tsx handles the full transition
 *  without any manual navigation calls.
 */

import type { AppDispatch } from '../redux/store';
import { clearAuth } from '../redux/features/auth/authSlice';
import { getActiveCall } from './livekit/activeCallRegistry';

export function performLogout(dispatch: AppDispatch): void {
  // 1. Close any active LiveKit call first so WebRTC cleans up before unmount.
  const activeCall = getActiveCall();
  if (activeCall) {
    activeCall.leave?.().catch(() => {});
  }

  // 2. Dispatch clearAuth — App.tsx's key-change handles the full navigation
  //    transition to PublicStackNavigator / LoginScreen.
  //    The persisted Hopenity blob is intentionally left intact so AuthBootstrap
  //    can restore the session on the next foreground or cold start.
  dispatch(clearAuth());
}
