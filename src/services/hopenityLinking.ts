import { Linking, Platform } from 'react-native';
import {
  HOPENITY_PACKAGE_ID,
  HOPENITY_IOS_SCHEME,
  PLAY_STORE_MARKET_URL,
  PLAY_STORE_WEB_URL,
} from '../constants/hopenity';

const ANDROID_LAUNCH_INTENT = `intent://hopenity#Intent;scheme=https;package=${HOPENITY_PACKAGE_ID};end`;

export async function canOpenHopenity(): Promise<boolean> {
  try {
    if (Platform.OS === 'ios') {
      return await Linking.canOpenURL(HOPENITY_IOS_SCHEME);
    }
    return await Linking.canOpenURL(ANDROID_LAUNCH_INTENT);
  } catch {
    return false;
  }
}

export async function openHopenityBestEffort(): Promise<void> {
  const candidates =
    Platform.OS === 'ios'
      ? [HOPENITY_IOS_SCHEME]
      : [`${HOPENITY_PACKAGE_ID}://`, ANDROID_LAUNCH_INTENT];

  for (const url of candidates) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const ok = await Linking.canOpenURL(url);
      if (ok) {
        // eslint-disable-next-line no-await-in-loop
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
