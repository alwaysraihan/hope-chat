import { Linking, Platform } from 'react-native';
import {
  HOPENITY_PACKAGE_ID,
  HOPENITY_IOS_SCHEME,
  PLAY_STORE_MARKET_URL,
  PLAY_STORE_WEB_URL,
} from '../constants/hopenity';

const ANDROID_LAUNCH_INTENT = `intent://hopenity.com/#Intent;scheme=hopenity;package=${HOPENITY_PACKAGE_ID};end`;
const ANDROID_HOPENITY_URI = 'hopenity://hopenity.com/';
// Special path Hopenity handles to send the auth token back to HopeChat.
// When Hopenity receives this deep link it calls openHopeChat() which fires
// hopechat://auth?token=... back, completing the login handshake.
const ANDROID_AUTH_REQUEST_URI = 'hopenity://hopenity.com/hopechat-auth-request';
const IOS_AUTH_REQUEST_URI = `${HOPENITY_IOS_SCHEME}hopechat-auth-request`;

export async function canOpenHopenity(): Promise<boolean> {
  try {
    if (Platform.OS === 'ios') {
      return await Linking.canOpenURL(HOPENITY_IOS_SCHEME);
    }
    return await Linking.canOpenURL(ANDROID_HOPENITY_URI);
  } catch {
    return false;
  }
}

export async function openHopenityBestEffort(): Promise<void> {
  const candidates =
    Platform.OS === 'ios'
      ? [HOPENITY_IOS_SCHEME]
      : [ANDROID_HOPENITY_URI, `${HOPENITY_PACKAGE_ID}://`, ANDROID_LAUNCH_INTENT];

  for (const url of candidates) {
    try {
      const ok = await Linking.canOpenURL(url);
      if (ok) {
        await Linking.openURL(url);
        return;
      }
    } catch {
      /* try next */
    }
  }
  await openPlayStore();
}

/**
 * Open Hopenity with a special path that signals "please send back the
 * current auth token so HopeChat can log in".
 *
 * Flow (Messenger-like):
 *  1. HopeChat LoginScreen shows "Sign in with Hopenity" (no session yet).
 *  2. User taps it → this function opens Hopenity.
 *  3. Hopenity's deep-link handler detects `hopechat-auth-request` and
 *     calls openHopeChat() which fires hopechat://auth?token=...&user=...
 *  4. HopeChat's App.tsx receives the deep link → setPendingAuthLink →
 *     LoginScreen processes it → user is logged in with "Continue as {name}".
 *
 * Falls back to plain app open or Play Store if Hopenity isn't installed.
 */
export async function openHopenityForAuthRequest(): Promise<void> {
  const authUri =
    Platform.OS === 'ios' ? IOS_AUTH_REQUEST_URI : ANDROID_AUTH_REQUEST_URI;
  try {
    await Linking.openURL(authUri);
    return;
  } catch {
    /* fall through to generic open */
  }
  await openHopenityBestEffort();
}

export async function openPlayStore(): Promise<void> {
  try {
    await Linking.openURL(PLAY_STORE_MARKET_URL);
  } catch {
    await Linking.openURL(PLAY_STORE_WEB_URL);
  }
}

/**
 * Opens the Hopenity app on the public profile page of the given user.
 * Tries the deep-link scheme first (hopenity://hopenity.com/profile/{userId});
 * falls back to opening the web profile URL in the browser if the app is not
 * installed or the scheme is not handled.
 */
export async function openHopenityPost(postId: string | number): Promise<void> {
  const id = String(postId ?? '').trim();
  if (!id) { await openHopenityBestEffort(); return; }

  const deepLink =
    Platform.OS === 'ios'
      ? `https://hopenity.com/post/${id}`
      : `hopenity://hopenity.com/post/${id}`;

  try {
    const ok = await Linking.canOpenURL(deepLink);
    if (ok) { await Linking.openURL(deepLink); return; }
  } catch { /* fall through */ }

  try {
    await Linking.openURL(`https://hopenity.com/post/${id}`);
  } catch { /* nothing else to try */ }
}

export async function openHopenityProfile(userId: string | number): Promise<void> {
  const id = String(userId ?? '').trim();
  if (!id) { await openHopenityBestEffort(); return; }

  // iOS: Hopenity registers `applinks:hopenity.com` (Universal Links), so the
  // correct deep link is https://hopenity.com/user/{id}. The custom scheme
  // hopenity://user/{id} would parse "user" as the hostname and Hopenity's
  // parseDeepLinkUrl would reject it (host doesn't include "hopenity.com").
  // Android: hopenity://hopenity.com/user/{id} matches the intent filter
  // (scheme=hopenity, host=hopenity.com, pathPrefix=/). On Android 11+ if
  // canOpenURL returns false (missing <queries>), fall through to HTTPS which
  // is also caught by Hopenity's autoVerify intent filter.
  const deepLink =
    Platform.OS === 'ios'
      ? `https://hopenity.com/user/${id}`
      : `hopenity://hopenity.com/user/${id}`;

  try {
    const ok = await Linking.canOpenURL(deepLink);
    if (ok) { await Linking.openURL(deepLink); return; }
  } catch { /* fall through */ }

  // Fallback: open the web profile (also caught by Hopenity's intent filters).
  try {
    await Linking.openURL(`https://hopenity.com/user/${id}`);
  } catch { /* nothing else to try */ }
}
