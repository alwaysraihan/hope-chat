import { Platform } from 'react-native';
import notifee, {
  AndroidForegroundServiceType,
  AndroidImportance,
} from '@notifee/react-native';

const ONGOING_CHANNEL_ID = 'hopechat_ongoing_call';
const ONGOING_NOTIFICATION_ID = 'hopechat_ongoing_livekit';

async function ensureOngoingChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await notifee.createChannel({
    id: ONGOING_CHANNEL_ID,
    name: 'Ongoing calls',
    description: 'Keeps Hope Chat connected while you are in a voice or video call.',
    importance: AndroidImportance.DEFAULT,
    sound: undefined,
  });
}

export type LiveKitCallForegroundKind = 'audio' | 'video';

function serviceTypes(
  kind: LiveKitCallForegroundKind,
): AndroidForegroundServiceType[] {
  const base: AndroidForegroundServiceType[] = [
    AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_PHONE_CALL,
    AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_MICROPHONE,
  ];
  if (kind === 'video') {
    base.push(AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_CAMERA);
  }
  return base;
}

export async function startLiveKitCallForeground(
  displayName: string,
  kind: LiveKitCallForegroundKind,
  statusLine?: string,
): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await ensureOngoingChannel();
  } catch (e) {
    console.warn('[LiveKit FGS] channel', e);
  }

  const body =
    statusLine?.trim() ||
    (kind === 'video' ? 'Video call in progress' : 'Voice call in progress');

  try {
    await notifee.displayNotification({
      id: ONGOING_NOTIFICATION_ID,
      title: displayName,
      body,
      android: {
        channelId: ONGOING_CHANNEL_ID,
        asForegroundService: true,
        foregroundServiceTypes: serviceTypes(kind),
        ongoing: true,
        colorized: true,
        importance: AndroidImportance.DEFAULT,
        pressAction: {
          id: 'default',
          launchActivity: 'default',
        },
      },
    });
  } catch (e) {
    console.warn('[LiveKit FGS] displayNotification', e);
  }
}

export async function updateLiveKitCallForegroundStatus(
  displayName: string,
  kind: LiveKitCallForegroundKind,
  statusLine: string,
): Promise<void> {
  if (Platform.OS !== 'android') return;
  await notifee.displayNotification({
    id: ONGOING_NOTIFICATION_ID,
    title: displayName,
    body: statusLine,
    android: {
      channelId: ONGOING_CHANNEL_ID,
      asForegroundService: true,
      foregroundServiceTypes: serviceTypes(kind),
      ongoing: true,
      colorized: true,
      importance: AndroidImportance.DEFAULT,
      pressAction: {
        id: 'default',
        launchActivity: 'default',
      },
    },
  });
}

export async function stopLiveKitCallForeground(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await notifee.stopForegroundService();
  } catch {
    /* noop if nothing running */
  }
  await notifee.cancelNotification(ONGOING_NOTIFICATION_ID);
}
