import { getApp } from '@react-native-firebase/app';
import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import notifee from '@notifee/react-native';

import {
  displayAndroidIncomingCallNotification,
  ensureIncomingCallAndroidChannel,
} from './androidIncomingCallUi';
import { normalizeFcmData, parseIncomingCallPayload } from './payload';

notifee.onBackgroundEvent(async () => {
  /* Taps are handled after JS loads via notifee.getInitialNotification / onForegroundEvent */
});

const messaging = getMessaging(getApp());

/**
 * Headless JS: data-only FCM while backgrounded/killed — show ringing notification with
 * full-screen intent where OS + user settings allow.
 */
setBackgroundMessageHandler(messaging, async remoteMessage => {
  const parsed = parseIncomingCallPayload(normalizeFcmData(remoteMessage.data));
  if (!parsed) return;

  await ensureIncomingCallAndroidChannel();
  await displayAndroidIncomingCallNotification(parsed);
});
