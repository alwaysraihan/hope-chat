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
/**
 * Open a hopenity.com path inside the Hopenity app, falling back to the web.
 *
 * Always tries the `hopenity://` custom scheme first, on both platforms.
 * Hopenity registers it in CFBundleURLSchemes (iOS) and an intent-filter
 * (Android), and Hope Chat lists it under LSApplicationQueriesSchemes so
 * canOpenURL can actually see it.
 *
 * The HTTPS URL is only a fallback. Relying on it to open the app means relying
 * on Universal Links, which need a valid apple-app-site-association served as
 * application/json from the domain — and canOpenURL can never detect the
 * failure, because Safari claims every http(s) URL.
 */
async function openHopenityPath(path: string): Promise<void> {
  const clean = path.replace(/^\/+/, '');
  const webUrl = `https://hopenity.com/${clean}`;
  const deepLink = `hopenity://hopenity.com/${clean}`;

  try {
    if (await Linking.canOpenURL(deepLink)) {
      await Linking.openURL(deepLink);
      return;
    }
  } catch {
    /* fall through to the web URL */
  }

  try {
    await Linking.openURL(webUrl);
  } catch {
    /* nothing else to try */
  }
}

export async function openHopenityPost(postId: string | number): Promise<void> {
  const id = String(postId ?? '').trim();
  if (!id) { await openHopenityBestEffort(); return; }
  await openHopenityPath(`post/${id}`);
}

export async function openHopenityProfile(userId: string | number): Promise<void> {
  const id = String(userId ?? '').trim();
  if (!id) { await openHopenityBestEffort(); return; }
  await openHopenityPath(`user/${id}`);
}

/**
 * Page profile. Hopenity's parser accepts `page`, `pages` and `page-profile`,
 * but its Android manifest only auto-verifies `/pages/` and `/page-profile/` —
 * so `/page/` links reach the app through the custom scheme only.
 */
export async function openHopenityPage(pageId: string | number): Promise<void> {
  const id = String(pageId ?? '').trim();
  if (!id) { await openHopenityBestEffort(); return; }
  await openHopenityPath(`pages/${id}`);
}

/** hoppi.live product / seller. Dispatched by host, so the host must survive. */
async function openHoppiPath(path: string): Promise<void> {
  const clean = path.replace(/^\/+/, '');
  const webUrl = `https://hoppi.live/${clean}`;
  const deepLink = `hopenity://hoppi.live/${clean}`;

  try {
    if (await Linking.canOpenURL(deepLink)) {
      await Linking.openURL(deepLink);
      return;
    }
  } catch {
    /* fall through */
  }

  try {
    await Linking.openURL(webUrl);
  } catch {
    /* nothing else to try */
  }
}

export async function openHoppiProduct(ref: string | number): Promise<void> {
  const id = String(ref ?? '').trim();
  if (!id) return;
  await openHoppiPath(`product/${id}`);
}

export async function openHoppiSeller(sellerId: string | number): Promise<void> {
  const id = String(sellerId ?? '').trim();
  if (!id) return;
  await openHoppiPath(`seller/${id}`);
}
