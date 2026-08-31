import { getApp } from '@react-native-firebase/app';
import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import notifee, { EventType } from '@notifee/react-native';
import { DeviceEventEmitter } from 'react-native';

import { store } from '../../redux/store';
import { HANGUP_ACTION_ID } from '../livekit/liveKitCallForeground';
import { notifyCallEndedByRoom } from '../invitePeerToHopeChatCall';

import {
  MESSAGE_CHANNEL_ID,
  displayMessagingNotification,
} from '../notifications/messageNotification';

import {
  cancelAndroidIncomingCallNotification,
  displayAndroidIncomingCallNotification,
  ensureIncomingCallAndroidChannel,
  INCOMING_CALL_ANDROID_CHANNEL_ID,
} from './androidIncomingCallUi';
import {
  CALL_CANCELLED_MESSAGE_TYPE,
  callPayloadSentAtMs,
  normalizeFcmData,
  parseIncomingCallPayload,
} from './payload';
import { ONGOING_NOTIFICATION_ID } from '../livekit/liveKitCallForeground';
import {
  OPEN_ACTIVE_CALL_EVENT,
  setPendingOpenActiveCall,
} from '../livekit/pendingCallScreenOpen';
import {
  startIncomingCallRingtone,
  stopIncomingCallRingtone,
  setPendingAutoAcceptData,
  setPendingRejectData,
  clearPendingAutoAcceptData,
} from './callRingtone';

// ── Messaging notifications ───────────────────────────────────────────────────
// The banner itself (Messenger-style: avatar + name + preview) is built in
// services/notifications/messageNotification so the foreground path renders the
// exact same notification.

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
    // Ongoing-call notification tapped while the app is backgrounded. This
    // context has no navigation, so record the intent; the main context acts on
    // it the moment the app foregrounds.
    // "Hang up" from the in-progress call notification while backgrounded.
    // Ends it server-side straight away so the peer is not left in a dead call
    // waiting for this app to be opened again.
    if (actionId === HANGUP_ACTION_ID) {
      const room = String(
        (detail.notification?.data as Record<string, string> | undefined)?.liveKitRoom ?? '',
      ).trim();
      const token = store.getState().auth.token;
      try {
        await notifee.stopForegroundService();
      } catch { /* best-effort */ }
      if (notifId) await notifee.cancelNotification(notifId);
      if (room && token) {
        try {
          await notifyCallEndedByRoom({ token, liveKitRoom: room, reason: 'hangup' });
        } catch { /* best-effort */ }
      }
      return;
    }

    if (notifId === ONGOING_NOTIFICATION_ID) {
      // Record WHICH call to return to, not merely that a return was requested.
      // The main context may find no registered call (the screen was backed out
      // of, or the process was restarted), in which case the room from the
      // notification is the only way to rebuild the screen.
      const d = detail.notification?.data as Record<string, string> | undefined;
      const pending = {
        liveKitRoom: String(d?.liveKitRoom ?? '').trim(),
        callKind: String(d?.callKind ?? ''),
        displayName: String(d?.displayName ?? ''),
      };
      setPendingOpenActiveCall(pending);
      // The flag alone is not enough: if the app is still 'active' (the call
      // screen was backed out of rather than the app backgrounded) no AppState
      // transition will ever occur to read it. Tell the live listener directly.
      DeviceEventEmitter.emit(OPEN_ACTIVE_CALL_EVENT, pending);
      return;
    }

    if (actionId === 'reject') {
      stopIncomingCallRingtone();
      if (notifId) await notifee.cancelNotification(notifId);
      const notifData = detail.notification?.data as Record<string, string> | undefined;
      if (notifData) {
        // Still record it, so the main app writes the missed-call row and clears
        // any pending ring UI when it next opens.
        try { setPendingRejectData(JSON.stringify(notifData)); } catch { /* noop */ }

        // ...but tell the SERVER right now. Decline has no launchActivity — the
        // app is never brought up — so deferring this to "next foreground" left
        // the caller ringing until the callee happened to open HopeChat, which
        // is indistinguishable from the Decline button doing nothing.
        const room = String(notifData.liveKitRoom ?? notifData.room ?? '').trim();
        const token = store.getState().auth.token;
        if (room && token) {
          try {
            await notifyCallEndedByRoom({ token, liveKitRoom: room });
          } catch {
            /* best-effort — the pending record above is the fallback */
          }
        }
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
const BG_CANCEL_TTL_MS = 5 * 60_000;
/** Suppression window for invites that carry no server `ts`. */
const BG_UNDATED_SUPPRESSION_MS = 8_000;

/** `cancelledAtMs` is the cancel's own server timestamp when the push carries one. */
function markBgRoomCancelled(room: string, cancelledAtMs = Date.now()): void {
  const prev = bgCancelledRooms.get(room) ?? 0;
  bgCancelledRooms.set(room, Math.max(prev, cancelledAtMs));
  // Evict stale entries to prevent unbounded growth.
  setTimeout(() => {
    const at = bgCancelledRooms.get(room);
    if (at != null && Date.now() - at >= BG_CANCEL_TTL_MS) {
      bgCancelledRooms.delete(room);
    }
  }, BG_CANCEL_TTL_MS);
}

/**
 * Room names are deterministic per pair, so a cancel can only invalidate invites
 * issued BEFORE it. The old blanket 90 s ban muted the callee's phone for a
 * minute and a half after any declined/missed call — an immediate retry never rang.
 */
function isBgRoomCancelled(room: string, sentAtMs?: number): boolean {
  const cancelledAt = bgCancelledRooms.get(room);
  if (cancelledAt === undefined) return false;
  if (Date.now() - cancelledAt > BG_CANCEL_TTL_MS) {
    bgCancelledRooms.delete(room);
    return false;
  }
  if (sentAtMs != null) return sentAtMs <= cancelledAt;
  return Date.now() - cancelledAt < BG_UNDATED_SUPPRESSION_MS;
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
      markBgRoomCancelled(cancelledRoom, callPayloadSentAtMs(data));
    }
    return;
  }

  // ── Incoming call — show full-screen call UI.
  const parsed = parseIncomingCallPayload(data);
  if (parsed) {
    // Guard against FCM ordering race: if a cancel for this room already arrived,
    // don't ring — the call is dead on the caller's side.
    if (isBgRoomCancelled(parsed.liveKitRoom, parsed.sentAtMs)) {
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
