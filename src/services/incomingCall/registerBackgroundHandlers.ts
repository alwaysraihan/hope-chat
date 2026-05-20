import { getApp } from '@react-native-firebase/app';
import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import notifee, { EventType } from '@notifee/react-native';

import {
  cancelAndroidIncomingCallNotification,
  displayAndroidIncomingCallNotification,
  ensureIncomingCallAndroidChannel,
  INCOMING_CALL_ANDROID_CHANNEL_ID,
} from './androidIncomingCallUi';
import {
  CALL_CANCELLED_MESSAGE_TYPE,
  normalizeFcmData,
  parseIncomingCallPayload,
} from './payload';
import {
  startIncomingCallRingtone,
  stopIncomingCallRingtone,
  setPendingAutoAcceptData,
  setPendingRejectData,
} from './callRingtone';

// Channels owned by HopeChat — never cancel these when suppressing unwanted auto-notifications.
const HOPECHAT_OWNED_CHANNEL_IDS = new Set([
  INCOMING_CALL_ANDROID_CHANNEL_ID,
  'hopechat_ongoing_call',
]);

/**
 * When a non-call FCM message has a notification payload, Android auto-displays it
 * before our JS handler runs. This cancels that spurious notification while leaving
 * our own call/ongoing-call notifications intact.
 */
async function suppressAutoDisplayedNonCallNotification(): Promise<void> {
  // Brief pause so Android finishes rendering the notification before we look for it.
  await new Promise<void>(resolve => setTimeout(resolve, 200));
  try {
    const displayed = await notifee.getDisplayedNotifications();
    await Promise.all(
      displayed
        .filter(n => !HOPECHAT_OWNED_CHANNEL_IDS.has(n.notification?.android?.channelId ?? ''))
        .map(n => (n.id ? notifee.cancelNotification(n.id) : Promise.resolve())),
    );
  } catch { /* best-effort */ }
}

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
      // Store the call data so the main app can emit the missed-call outcome and
      // signal the backend (which cancels the caller's active ring) next time it foregrounds.
      const notifData = detail.notification?.data;
      if (notifData) {
        try { setPendingRejectData(JSON.stringify(notifData)); } catch { /* noop */ }
      }
      return;
    }

    if (actionId === 'accept') {
      stopIncomingCallRingtone();
      if (notifId) await notifee.cancelNotification(notifId);
      // Store the call data in the native module (shared across JS contexts in the same
      // process). When the main app comes to foreground it reads this and auto-accepts.
      const notifData = detail.notification?.data;
      if (notifData) {
        try {
          setPendingAutoAcceptData(JSON.stringify(notifData));
        } catch {
          /* noop */
        }
      }
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
  if (!parsed) {
    // Not a call message. If the FCM payload had a notification object, Android
    // auto-displayed a banner — cancel it so only call notifications appear in HopeChat.
    if (remoteMessage.notification) {
      await suppressAutoDisplayedNonCallNotification();
    }
    return;
  }

  await ensureIncomingCallAndroidChannel();
  await displayAndroidIncomingCallNotification(parsed);
  startIncomingCallRingtone();
});
