import { Linking, Platform } from 'react-native';
import {
  HOPENITY_PACKAGE_ID,
  HOPENITY_IOS_SCHEME,
  PLAY_STORE_MARKET_URL,
  PLAY_STORE_WEB_URL,
} from '../constants/hopenity';

const ANDROID_LAUNCH_INTENT = `intent://hopenity.com/#Intent;scheme=hopenity;package=${HOPENITY_PACKAGE_ID};end`;
const ANDROID_HOPENITY_URI = 'hopenity://hopenity.com/';

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

export async function openPlayStore(): Promise<void> {
  try {
    await Linking.openURL(PLAY_STORE_MARKET_URL);
  } catch {
    await Linking.openURL(PLAY_STORE_WEB_URL);
  }
}
