import { Platform } from 'react-native';
import notifee, {
  AndroidCategory,
  AndroidImportance,
  AndroidVisibility,
} from '@notifee/react-native';

import { INCOMING_CALL_MESSAGE_TYPE, type IncomingCallPayload } from './payload';

/** Bump when channel semantics change (channels are mostly immutable once created). */
export const INCOMING_CALL_ANDROID_CHANNEL_ID = 'incoming_calls_v2';

/** Single slot so ringing updates Replace previous rather than stacking. */
export const INCOMING_CALL_NOTIFICATION_ID = 'hopechat_incoming_call';

const MAIN_COMPONENT_NAME = 'hopeChat';

export async function ensureIncomingCallAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await notifee.createChannel({
    id: INCOMING_CALL_ANDROID_CHANNEL_ID,
    name: 'Incoming calls',
    description: 'High-priority ringing for incoming voice and video calls',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
    lights: true,
    bypassDnd: true,
    visibility: AndroidVisibility.PUBLIC,
    vibrationPattern: [400, 800, 400, 800],
  });
}

/**
 * Tray + heads-up + full-screen intent (where OS + user permit). Used when JS is headless /
 * activity not visible — mirrors typical dialer UX.
 */
export async function displayAndroidIncomingCallNotification(
  parsed: IncomingCallPayload,
): Promise<void> {
  if (Platform.OS !== 'android') return;
  await ensureIncomingCallAndroidChannel();

  await notifee.displayNotification({
    id: INCOMING_CALL_NOTIFICATION_ID,
    title:
      parsed.callKind === 'video'
        ? 'Incoming video call'
        : 'Incoming voice call',
    body: parsed.displayName,
    data: {
      type: INCOMING_CALL_MESSAGE_TYPE,
      liveKitRoom: parsed.liveKitRoom,
      callKind: parsed.callKind,
      displayName: parsed.displayName,
      callerId: parsed.callerId ?? '',
    },
    android: {
      channelId: INCOMING_CALL_ANDROID_CHANNEL_ID,
      category: AndroidCategory.CALL,
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      ongoing: true,
      autoCancel: true,
      lightUpScreen: true,
      pressAction: {
        id: 'default',
        launchActivity: 'default',
      },
      fullScreenAction: {
        id: 'hope_incoming_fullscreen',
        launchActivity: 'default',
        mainComponent: MAIN_COMPONENT_NAME,
      },
      sound: 'default',
      vibrationPattern: [400, 800, 400, 800],
    },
  });
}

export async function cancelAndroidIncomingCallNotification(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await notifee.cancelNotification(INCOMING_CALL_NOTIFICATION_ID);
}
