import { Platform } from 'react-native';
import notifee, {
  AndroidForegroundServiceType,
  AndroidImportance,
} from '@notifee/react-native';

const ONGOING_CHANNEL_ID = 'hopechat_ongoing_call';
export const ONGOING_NOTIFICATION_ID = 'hopechat_ongoing_livekit';

/** Action id for the "Hang up" button on the in-progress call notification. */
export const HANGUP_ACTION_ID = 'hopechat_call_hangup';

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

/**
 * Identifies WHICH call the ongoing notification belongs to.
 *
 * The notification used to carry no data at all, which quietly broke both of
 * its buttons once the app was backgrounded: the background handler reads
 * `notification.data.liveKitRoom` to tell the server the call ended, so with no
 * data it found an empty room, skipped the server call, and the peer was left
 * in a call the other side had already hung up on. Tapping the body had the
 * same problem in reverse — nothing identified the call to navigate back to.
 */
export type LiveKitCallForegroundContext = {
  liveKitRoom: string;
  displayName: string;
  kind: LiveKitCallForegroundKind;
  /** Peer / group photo, so the ongoing-call notification is not a bare icon. */
  avatarUrl?: string | null;
};

function contextData(
  ctx: LiveKitCallForegroundContext | undefined,
  kind: LiveKitCallForegroundKind,
  displayName: string,
): Record<string, string> {
  return {
    liveKitRoom: ctx?.liveKitRoom ?? '',
    callKind: ctx?.kind ?? kind,
    displayName: ctx?.displayName ?? displayName,
    ongoingCall: '1',
  };
}

function serviceTypes(
  kind: LiveKitCallForegroundKind,
): AndroidForegroundServiceType[] {
  // phoneCall type requires MANAGE_OWN_CALLS or DIALER role — not available to VoIP apps.
  // microphone + camera cover the WebRTC media pipeline on Android 14+.
  const base: AndroidForegroundServiceType[] = [
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
  ctx?: LiveKitCallForegroundContext,
  /**
   * Which foreground-service types to claim, when that must differ from the
   * call kind. Claiming the CAMERA type before the room is connected is what
   * the delayed video start below exists to avoid, so the connecting-phase
   * notification passes 'audio' here: the user gets something to tap and hang
   * up from immediately, without the camera type being claimed early.
   */
  serviceKind?: LiveKitCallForegroundKind,
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
      data: contextData(ctx, kind, displayName),
      android: {
        channelId: ONGOING_CHANNEL_ID,
        smallIcon: 'ic_stat_notification',
        // Remote photo of whoever is on the call; launcher icon when there is none.
        largeIcon: ctx?.avatarUrl || 'ic_launcher',
        circularLargeIcon: true,
        asForegroundService: true,
        foregroundServiceTypes: serviceTypes(serviceKind ?? kind),
        ongoing: true,
        colorized: true,
        importance: AndroidImportance.DEFAULT,
        pressAction: {
          id: 'default',
          launchActivity: 'default',
        },
        // Hang up without going back into the app first. An in-progress call
        // that can only be ended by finding the call screen is a trap when the
        // screen has been backed out of.
        actions: [{ title: 'Hang up', pressAction: { id: HANGUP_ACTION_ID } }],
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
  ctx?: LiveKitCallForegroundContext,
): Promise<void> {
  if (Platform.OS !== 'android') return;
  await notifee.displayNotification({
    id: ONGOING_NOTIFICATION_ID,
    title: displayName,
    body: statusLine,
    data: contextData(ctx, kind, displayName),
    android: {
      channelId: ONGOING_CHANNEL_ID,
      smallIcon: 'ic_stat_notification',
      largeIcon: ctx?.avatarUrl || 'ic_launcher',
      circularLargeIcon: true,
      asForegroundService: true,
      foregroundServiceTypes: serviceTypes(kind),
      ongoing: true,
      colorized: true,
      importance: AndroidImportance.DEFAULT,
      pressAction: {
        id: 'default',
        launchActivity: 'default',
      },
      actions: [{ title: 'Hang up', pressAction: { id: HANGUP_ACTION_ID } }],
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
