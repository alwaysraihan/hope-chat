import { getApp } from '@react-native-firebase/app';
import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import notifee, { AndroidImportance, EventType } from '@notifee/react-native';

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
  clearPendingAutoAcceptData,
} from './callRingtone';

// ── Messaging notification channel ────────────────────────────────────────────

const MESSAGE_CHANNEL_ID = 'hopechat_messages_v1';

/**
 * FCM data.type values that are allowed to produce a push notification.
 * Calls are handled separately via the call-notification path.
 * FRIEND_REQUEST / FRIEND_REQUEST_ACCEPTED belong to Hopenity — only Hopenity
 * shows those banners. Every other social type (POST_LIKE, COMMENT, etc.) is
 * silently dropped here too.
 */
const ALLOWED_PUSH_TYPES = new Set([
  'MESSAGE',
]);

async function ensureMessagesChannel(): Promise<void> {
  await notifee.createChannel({
    id: MESSAGE_CHANNEL_ID,
    name: 'Messages & Requests',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
  });
}

async function displayMessagingNotification(
  data: Record<string, string>,
): Promise<void> {
  const type = (data.type ?? '').toUpperCase();
  if (!ALLOWED_PUSH_TYPES.has(type)) return;

  // Only MESSAGE reaches here — friend-request types are Hopenity-only.
  const senderName =
    data.sender_name ?? data.name ?? data.displayName ?? data.callerName ?? '';
  const title = senderName || 'New message';
  const body =
    data.body ??
    data.message ??
    data.content ??
    data.message_preview ??
    'You have a new message';

  await ensureMessagesChannel();
  await notifee.displayNotification({
    title,
    body,
    data,
    android: {
      channelId: MESSAGE_CHANNEL_ID,
      importance: AndroidImportance.HIGH,
      pressAction: { id: 'default', launchActivity: 'default' },
    },
  });
}

// ── Channel ownership guard ────────────────────────────────────────────────────

// Channels owned by HopeChat — never cancel these when suppressing unwanted auto-notifications.
const HOPECHAT_OWNED_CHANNEL_IDS = new Set([
  INCOMING_CALL_ANDROID_CHANNEL_ID,
  'hopechat_ongoing_call',
  MESSAGE_CHANNEL_ID,
]);

/**
 * When an FCM message has a notification payload, Android auto-displays it before
 * our JS handler runs. This cancels that spurious banner while leaving our own
 * call / ongoing-call / message notifications intact.
 */
async function suppressAutoDisplayedNotification(): Promise<void> {
  // Brief pause so Android finishes rendering the notification before we look for it.
  await new Promise<void>(resolve => setTimeout(resolve, 200));
  try {
    const displayed = await notifee.getDisplayedNotifications();
    await Promise.all(
      displayed
        .filter(
          n =>
            !HOPECHAT_OWNED_CHANNEL_IDS.has(
              n.notification?.android?.channelId ?? '',
            ),
        )
        .map(n => (n.id ? notifee.cancelNotification(n.id) : Promise.resolve())),
    );
  } catch { /* best-effort */ }
}

// ── Notifee background event handler ──────────────────────────────────────────

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

// ── FCM background message handler ────────────────────────────────────────────

const messaging = getMessaging(getApp());

/**
 * Module-level cancelled-room tracker for the background JS context.
 *
 * Problem: FCM delivery order is not guaranteed. A `call_cancelled` FCM can
 * arrive BEFORE the matching `incoming_call` FCM (network path differences,
 * priority batching). If we handle `call_cancelled` first but then process
 * `incoming_call` afterward, we'd ring for a call that's already dead.
 *
 * Fix: keep a Map of room → cancelledAt timestamp. Before showing any incoming
 * call notification, check this map. Entries auto-expire after 90 s so stale
 * cancels don't block future unrelated calls on the same room name.
 *
 * Note: This Map lives only within the headless JS process. The in-process
 * foreground handler has its own `cancelledRooms` Set in navigateIncomingCall.ts
 * — both are needed because the contexts can be different JS instances.
 */
const bgCancelledRooms = new Map<string, number>();
const BG_CANCEL_TTL_MS = 90_000;

function markBgRoomCancelled(room: string): void {
  bgCancelledRooms.set(room, Date.now());
  // Evict stale entries to prevent unbounded growth.
  setTimeout(() => bgCancelledRooms.delete(room), BG_CANCEL_TTL_MS);
}

function isBgRoomCancelled(room: string): boolean {
  const ts = bgCancelledRooms.get(room);
  if (ts === undefined) return false;
  if (Date.now() - ts > BG_CANCEL_TTL_MS) {
    bgCancelledRooms.delete(room);
    return false;
  }
  return true;
}

/**
 * Headless JS: data-only FCM while backgrounded/killed.
 *
 * Push notification allow-list:
 *   • incoming_call / call variants  → full-screen call UI + ringtone
 *   • MESSAGE, FRIEND_REQUEST, FRIEND_REQUEST_ACCEPTED → chat notification banner
 *   • everything else (likes, comments, etc.)          → silently suppressed
 */
setBackgroundMessageHandler(messaging, async remoteMessage => {
  const data = normalizeFcmData(remoteMessage.data);

  // ── Call cancelled / answered on another device — tear down ringing immediately.
  const isCancelled =
    data.type === CALL_CANCELLED_MESSAGE_TYPE ||
    data.type === 'call_cancel' ||
    data.cancelled === '1' ||
    data.cancelled === 'true';

  if (isCancelled) {
    stopIncomingCallRingtone();
    await cancelAndroidIncomingCallNotification();
    // If the user pressed "Accept" on the notification before the call was
    // cancelled, discard the stored auto-accept data so the app doesn't
    // join a dead LiveKit room when it next foregrounds.
    await clearPendingAutoAcceptData();
    // Track the cancelled room so a late-arriving incoming_call FCM for the
    // same room is silently discarded (FCM ordering is not guaranteed).
    const cancelledRoom = data.liveKitRoom || data.room;
    if (typeof cancelledRoom === 'string' && cancelledRoom.length > 0) {
      markBgRoomCancelled(cancelledRoom);
    }
    return;
  }

  // ── Incoming call — show full-screen call UI.
  const parsed = parseIncomingCallPayload(data);
  if (parsed) {
    // Guard against FCM ordering race: if a cancel for this room already arrived,
    // don't ring — the call is dead on the caller's side.
    if (isBgRoomCancelled(parsed.liveKitRoom)) {
      if (__DEV__) {
        console.warn('[HopeChat BG] Dropping incoming_call FCM — room already cancelled:', parsed.liveKitRoom);
      }
      return;
    }

    await ensureIncomingCallAndroidChannel();
    await displayAndroidIncomingCallNotification(parsed);
    startIncomingCallRingtone();

    // Auto-cancel the notification after the ring timeout (60 s) so a sleeping
    // phone doesn't ring indefinitely when the cancel FCM is delayed or dropped.
    // This is a safety net — the explicit call_cancelled FCM cancels it sooner.
    const ringRoom = parsed.liveKitRoom;
    setTimeout(async () => {
      // Only cancel if this is still the same call (not replaced by a new one).
      try {
        stopIncomingCallRingtone();
        await cancelAndroidIncomingCallNotification();
        await clearPendingAutoAcceptData();
      } catch { /* best-effort */ }
    }, 60_000);
    return;
  }

  // ── Not a call — suppress any Android auto-displayed banner first (FCM with
  //    notification payload gets auto-shown by Android before JS runs).
  if (remoteMessage.notification) {
    await suppressAutoDisplayedNotification();
  }

  // ── Only messaging-related types get a push notification.
  //    All other types (POST_LIKE, COMMENT, STORY_REACTION, etc.) are dropped.
  await displayMessagingNotification(data);
});
