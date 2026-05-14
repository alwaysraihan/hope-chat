import { getApp } from '@react-native-firebase/app';
import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import notifee, { EventType } from '@notifee/react-native';

import {
  cancelAndroidIncomingCallNotification,
  displayAndroidIncomingCallNotification,
  ensureIncomingCallAndroidChannel,
} from './androidIncomingCallUi';
import {
  CALL_CANCELLED_MESSAGE_TYPE,
  normalizeFcmData,
  parseIncomingCallPayload,
} from './payload';
import {
  startIncomingCallRingtone,
  stopIncomingCallRingtone,
} from './callRingtone';

notifee.onBackgroundEvent(async ({ type, detail }) => {
  const actionId = detail.pressAction?.id;
  const notifId = detail.notification?.id;

  if (type === EventType.DISMISSED) {
    stopIncomingCallRingtone();
    return;
  }

  if (type === EventType.PRESS) {
    if (actionId === 'reject') {
      stopIncomingCallRingtone();
      if (notifId) await notifee.cancelNotification(notifId);
      return;
    }

    if (actionId === 'accept') {
      // Stop ringtone and clear the notification immediately so the call screen
      // appears clean when the app opens via launchActivity.
      stopIncomingCallRingtone();
      if (notifId) await notifee.cancelNotification(notifId);
      return;
    }

    // Default body tap: stop ringtone; app opens normally via launchActivity.
    stopIncomingCallRingtone();
  }
});

const messaging = getMessaging(getApp());

/**
 * Headless JS: data-only FCM while backgrounded/killed.
 * Handles both incoming calls (show notification + start ringtone) and
 * call cancellations (stop ringtone + cancel notification for calls answered elsewhere).
 */
setBackgroundMessageHandler(messaging, async remoteMessage => {
  const data = normalizeFcmData(remoteMessage.data);

  // Call cancelled / answered on another device — tear down ringing immediately.
  const isCancelled =
    data.type === CALL_CANCELLED_MESSAGE_TYPE ||
    data.type === 'call_cancel' ||
    data.cancelled === '1' ||
    data.cancelled === 'true';

  if (isCancelled) {
    stopIncomingCallRingtone();
    await cancelAndroidIncomingCallNotification();
    return;
  }

  const parsed = parseIncomingCallPayload(data);
  if (!parsed) return;

  await ensureIncomingCallAndroidChannel();
  await displayAndroidIncomingCallNotification(parsed);
  startIncomingCallRingtone();
});
