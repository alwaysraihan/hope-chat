import React, { useEffect } from 'react';
import { AppState, DeviceEventEmitter, Platform } from 'react-native';
import { RELOAD_CHAT_LIST_EVENT } from '../context/ChatsContext';
import NetInfo from '@react-native-community/netinfo';
import { getApp } from '@react-native-firebase/app';
import {
  getInitialNotification,
  getMessaging,
  getToken,
  onMessage,
  onNotificationOpenedApp,
  onTokenRefresh,
  registerDeviceForRemoteMessages,
  requestPermission,
} from '@react-native-firebase/messaging';
import notifee, { AuthorizationStatus, EventType } from '@notifee/react-native';

import { useAppSelector } from '../hooks/redux';
import { selectHopeChatLoggedIn, setActivePage } from '../redux/features/auth/authSlice';
import { store } from '../redux/store';
import {
  CALL_CANCELLED_MESSAGE_TYPE,
  INCOMING_CALL_MESSAGE_TYPE,
  callPayloadSentAtMs,
  normalizeFcmData,
  parseIncomingCallPayload,
} from '../services/incomingCall/payload';
import {
  consumePendingIncomingCall,
  navigateIncomingCall,
  clearPendingIncomingCall,
  markCallCancelled,
  isCallCancelled,
} from '../services/incomingCall/navigateIncomingCall';
import {
  cancelAndroidIncomingCallNotification,
  ensureIncomingCallAndroidChannel,
} from '../services/incomingCall/androidIncomingCallUi';
import {
  startIncomingCallRingtone,
  stopIncomingCallRingtone,
  consumePendingAutoAcceptData,
  consumePendingRejectData,
} from '../services/incomingCall/callRingtone';
import { ensureCallReliability } from '../services/incomingCall/callReliability';
import { navigationRef } from '../navigation/navigationRef';
import {
  emitCallWaiting,
  emitCallWaitingCleared,
} from '../services/incomingCall/callWaitingBus';
import { postFcmTokenToHopenity } from '../services/registerFcmDeviceToken';
import { publishKeys } from '../services/e2ee/keyDirectory';
import { scheduleArchiveSync } from '../services/e2ee/archive';
import {
  getActiveCall,
  endActiveCallForReplacement,
  endActiveCallForRemoteHangup,
  readPersistedActiveCall,
} from '../services/livekit/activeCallRegistry';
import {
  HANGUP_ACTION_ID,
  ONGOING_NOTIFICATION_ID,
  stopLiveKitCallForeground,
} from '../services/livekit/liveKitCallForeground';
import {
  consumePendingOpenActiveCall,
  consumePendingOpenActiveCallData,
  OPEN_ACTIVE_CALL_EVENT,
  type PendingCallScreenData,
} from '../services/livekit/pendingCallScreenOpen';
import { StackActions, CommonActions } from '@react-navigation/native';
import { emitCallOutcome } from '../services/callOutcomeBus';
import {
  notifyCallEndedByRoom,
  notifyPeerCallRejected,
} from '../services/invitePeerToHopeChatCall';
import { callSocket } from '../services/callSocket';
import {
  displayMessagingNotification,
  notificationChatId,
  notificationTargetPage,
} from '../services/notifications/messageNotification';
import CallReliabilityPrompt from './CallReliabilityPrompt';

/**
 * If the IncomingCallScreen is currently showing for this room, dismiss it.
 * Called when a call_cancelled FCM arrives while the app is foregrounded.
 */
function dismissIncomingCallIfShowing(liveKitRoom?: string): void {
  if (!navigationRef.isReady()) return;
  const current = navigationRef.getCurrentRoute();
  if (current?.name !== 'IncomingCall') return;
  const params = current.params as { liveKitRoom?: string } | undefined;
  if (liveKitRoom && params?.liveKitRoom !== liveKitRoom) return;
  stopIncomingCallRingtone();
  void cancelAndroidIncomingCallNotification();
  navigationRef.goBack();
}

/**
 * The peer hung up / declined. This has to END the call screen, not just drop the
 * LiveKit connection — `leave()` is the silent variant used for call replacement,
 * and calling it here is what left the caller's phone showing "Calling…" forever
 * after the other side declined.
 */
/**
 * Every notification surface a call can own, cleared in one place.
 *
 * The cancel paths used to clear only the *incoming* notification and the
 * ringtone, leaving the ongoing-call notification (and its foreground service)
 * alive after the other side hung up — the tray kept showing a call that no
 * longer existed, and its Hang up button acted on a dead room.
 */
function clearAllCallNotifications(): void {
  stopIncomingCallRingtone();
  void cancelAndroidIncomingCallNotification();
  void stopLiveKitCallForeground().catch(() => undefined);
}

function endActiveCallIfMatchesRoom(liveKitRoom?: string): void {
  if (!liveKitRoom) return;
  const active = getActiveCall();
  if (!active || active.liveKitRoom !== liveKitRoom) return;
  void endActiveCallForRemoteHangup(liveKitRoom);
}

/**
 * Accept a call directly — skips IncomingCallScreen entirely so the user lands
 * straight on the call screen with no intermediate flash.
 */
async function acceptCallDirectly(parsed: ReturnType<typeof parseIncomingCallPayload>): Promise<void> {
  if (!parsed || !navigationRef.isReady()) return;
  stopIncomingCallRingtone();
  void cancelAndroidIncomingCallNotification();

  const isGroupRing = Boolean(parsed.isGroupCall && parsed.groupName);
  const params = {
    // Group call screens are titled by the group, not the caller.
    displayName: isGroupRing ? (parsed.groupName as string) : parsed.displayName ?? '',
    liveKitRoom: parsed.liveKitRoom,
    avatarUrl: (isGroupRing ? parsed.groupPhotoUrl ?? parsed.avatarUrl : parsed.avatarUrl) ?? null,
    conversationId: parsed.conversationId,
    peerUserId: parsed.callerId,
    callDirection: 'incoming' as const,
    isGroupCall: isGroupRing || undefined,
  };
  const targetRoute = parsed.callKind === 'video' ? 'VideoCall' : 'AudioCall';

  const active = getActiveCall();
  if (active && active.liveKitRoom !== parsed.liveKitRoom) {
    await endActiveCallForReplacement(parsed.liveKitRoom);
    // Give native WebRTC teardown a moment to settle before joining the new room.
    await new Promise(resolve => setTimeout(resolve, 150));
    navigationRef.dispatch(
      CommonActions.reset({ index: 1, routes: [{ name: 'BottomTab' }, { name: targetRoute, params }] }),
    );
  } else {
    navigationRef.dispatch(StackActions.push(targetRoute, params));
  }
}

/**
 * When the user taps the ongoing-call foreground-service notification, bring the
 * active call screen back to front. The minimize button pushes a BottomTab on top;
 * we find the call screen in the stack and pop back to it.
 */
function navigateToActiveCallScreen(): void {
  if (!navigationRef.isReady()) return;
  const active = getActiveCall();
  if (!active) return;
  const targetRoute = active.kind === 'video' ? 'VideoCall' : 'AudioCall';
  try {
    const state = navigationRef.getRootState();
    const routes = (state?.routes ?? []) as Array<{ name: string }>;
    // Search from the top: minimising pushes a BottomTab above the call screen,
    // and repeated minimise/return cycles can leave more than one call route in
    // the stack. The *last* one is the live screen.
    let callIdx = -1;
    for (let i = routes.length - 1; i >= 0; i -= 1) {
      if (routes[i]?.name === targetRoute) {
        callIdx = i;
        break;
      }
    }
    if (callIdx === -1) {
      // The user backed out of the call screen while the call kept running, so
      // the route is gone. Re-create it from the params the screen registered —
      // pushing it bare gave a screen with no room to join, which is why the
      // ongoing "connected" notification looked dead when tapped.
      const params = active.screenParams;
      if (params) {
        navigationRef.dispatch({
          ...StackActions.push(targetRoute, params),
          target: state?.key,
        });
      } else if (__DEV__) {
        console.warn('[HopeChat] active call has no screenParams — cannot restore screen');
      }
      return;
    }
    const popCount = routes.length - 1 - callIdx;
    if (popCount > 0) {
      // Target the ROOT navigator explicitly. An untargeted StackActions.pop is
      // delivered to the focused navigator, which after backing out of the call
      // is a stack nested inside BottomTab — popping there would shuffle the
      // chat list and leave the call screen exactly where it was.
      navigationRef.dispatch({
        ...StackActions.pop(popCount),
        target: state?.key,
      });
    }
  } catch (e) {
    if (__DEV__) console.warn('[HopeChat] navigateToActiveCallScreen', e);
  }
}

/**
 * The tap may have been handled in the background JS context (app backgrounded)
 * or land as a cold-start initial notification — in both cases navigation only
 * becomes possible once we are foregrounded and mounted.
 */
const OPEN_CALL_MAX_ATTEMPTS = 20;

function openActiveCallScreenWhenReady(
  attempt = 0,
  notifData?: Record<string, string>,
): void {
  if (!navigationRef.isReady()) {
    if (attempt >= OPEN_CALL_MAX_ATTEMPTS) return;
    setTimeout(() => openActiveCallScreenWhenReady(attempt + 1, notifData), 150);
    return;
  }

  if (getActiveCall()) {
    navigateToActiveCallScreen();
    return;
  }

  /**
   * No registry entry. Two reasons, and BOTH must be handled or the tap does
   * nothing at all:
   *   1. the call is still connecting and hasn't registered yet — wait briefly;
   *   2. the call screen was unmounted (backed out of, or the process was
   *      restarted) and will never register — rebuild the screen from the room
   *      the notification carries.
   *
   * The previous version returned on `attempt > 20` at the top of the function,
   * which made the case-2 fallback below unreachable: after ~3 s of retries the
   * tap was silently dropped. That is exactly the "notification does nothing"
   * report — it only ever worked while the screen happened to still be mounted.
   */
  // When the notification names the room we do not need the full wait: a short
  // grace for a still-connecting call, then rebuild from the payload.
  const maxAttempts = notifData?.liveKitRoom ? 4 : OPEN_CALL_MAX_ATTEMPTS;
  if (attempt < maxAttempts) {
    setTimeout(() => openActiveCallScreenWhenReady(attempt + 1, notifData), 150);
    return;
  }
  /**
   * Last resort: the process was restarted, so nothing is registered and the
   * notification may not have carried the room either (older builds). The
   * on-disk mirror of the live call still has the params to re-enter it.
   */
  const persisted = readPersistedActiveCall();
  navigateToCallFromNotificationData(
    notifData?.liveKitRoom
      ? notifData
      : persisted
        ? {
            liveKitRoom: persisted.liveKitRoom,
            callKind: persisted.kind,
            displayName: String(
              (persisted.screenParams?.displayName as string) ?? '',
            ),
          }
        : undefined,
  );
}

/**
 * Last-resort navigation when no call is registered: rebuild the call route
 * from what the ongoing notification carries.
 */
function navigateToCallFromNotificationData(
  data?: Record<string, string>,
): void {
  const liveKitRoom = String(data?.liveKitRoom ?? '').trim();
  if (!liveKitRoom || !navigationRef.isReady()) return;
  const targetRoute =
    String(data?.callKind ?? '') === 'video' ? 'VideoCall' : 'AudioCall';
  try {
    const state = navigationRef.getRootState();
    const routes = (state?.routes ?? []) as Array<{ name: string }>;
    // The press can be delivered to BOTH the foreground and background handler.
    // Without this, the two would push two call screens onto the stack.
    if (routes.some(r => r.name === targetRoute)) {
      navigateToActiveCallScreen();
      return;
    }
    // Prefer the exact params the screen was mounted with — they carry the
    // conversation id, avatar and group flag that a bare push payload lacks.
    const persisted = readPersistedActiveCall();
    const savedParams =
      persisted?.liveKitRoom === liveKitRoom ? persisted.screenParams : undefined;
    navigationRef.dispatch({
      ...StackActions.push(targetRoute, {
        ...(savedParams ?? {}),
        displayName:
          String(savedParams?.displayName ?? data?.displayName ?? ''),
        liveKitRoom,
        avatarUrl: (savedParams?.avatarUrl as string | null) ?? null,
        // NOT 'outgoing': this is a re-entry into a call already in progress.
        // Marking it outgoing restarts the ringback, the 60 s no-answer timer
        // and the "not connected" call-log row.
        callDirection: 'incoming' as const,
      }),
      target: state?.key,
    });
  } catch (e) {
    if (__DEV__) console.warn('[HopeChat] restore call from notification', e);
  }
}

/**
 * Hang up from the ongoing notification.
 *
 * Tears the call down locally AND tells the server, so the peer's phone stops
 * ringing / leaves the call. The server signal is the part that must always
 * run: when the call screen is unmounted there is no registry entry and no
 * LiveKit teardown to signal the peer, so without this the other end stayed in
 * the call indefinitely.
 */
async function hangUpOngoingCall(liveKitRoom: string): Promise<void> {
  const active = getActiveCall();
  if (active && (!liveKitRoom || active.liveKitRoom === liveKitRoom)) {
    try {
      await endActiveCallForRemoteHangup(active.liveKitRoom);
    } catch { /* the notification and server signal below still have to run */ }
  }
  try {
    await stopLiveKitCallForeground();
  } catch { /* best-effort */ }
  const token = store.getState().auth.token;
  if (liveKitRoom && token) {
    try {
      await notifyCallEndedByRoom({ token, liveKitRoom, reason: 'hangup' });
    } catch { /* best-effort */ }
  }
}

/**
 * Process a pending reject: emit the missed-call outcome so the server is
 * notified and sends a cancel FCM to the caller.
 */
function processRejectPayload(raw: Record<string, string>): void {
  const parsed = parseIncomingCallPayload(raw);
  if (!parsed) return;

  // NOTE: this used to bail out entirely when conversationId or callerId was
  // missing — `if (!parsed?.conversationId || !parsed?.callerId) return;` — so a
  // push without those fields dropped the WHOLE decline, server signal included,
  // and the caller kept ringing until the 60s timeout. Telling the server is the
  // part that must never be skipped, so it now runs off the room alone.
  const token = store.getState().auth.token;
  if (token && parsed.liveKitRoom && !parsed.isGroupCall) {
    // Room-keyed: the server resolves the peer from the room it recorded at
    // invite time, so no conversationId is required.
    void notifyCallEndedByRoom({ token, liveKitRoom: parsed.liveKitRoom });
  }

  // The missed-call row is best-effort and genuinely does need these ids.
  if (parsed.conversationId && parsed.callerId) {
    emitCallOutcome({
      conversationId: parsed.conversationId,
      callKind: parsed.callKind,
      variant: 'incoming_missed',
      peerUserId: parsed.callerId,
      peerDisplayName: parsed.displayName,
    });
  }
  dismissIncomingCallIfShowing(parsed.liveKitRoom);
}

/**
 * Tapping a message banner should land in that conversation, the way Messenger
 * does — not just open the app on whatever screen it left off.
 */
function openChatFromNotification(raw: Record<string, string>): boolean {
  if ((raw.type ?? '').toUpperCase() !== 'MESSAGE') return false;
  const chatId = notificationChatId(raw);
  if (!chatId) return false;

  // A message addressed to one of this user's pages belongs to that page's
  // inbox. Switch identity BEFORE navigating, or the thread opens in the
  // operator's personal context and replies go out as the wrong sender.
  const targetPage = notificationTargetPage(raw);
  if (targetPage?.id) {
    const current = store.getState().auth.activePage;
    if (String(current?.id ?? '') !== targetPage.id) {
      store.dispatch(
        setActivePage({
          id: targetPage.id,
          name: targetPage.name || current?.name || '',
          image: null,
        }),
      );
    }
  }
  const open = (attempt = 0) => {
    if (!navigationRef.isReady()) {
      if (attempt > 20) return;
      setTimeout(() => open(attempt + 1), 150);
      return;
    }
    if (isViewingChat(chatId)) return;
    try {
      navigationRef.dispatch(
        StackActions.push('Inbox', {
          conversationId: chatId,
          displayName: raw.sender_name ?? raw.senderName,
          avatarUrl: raw.sender_image ?? raw.senderImage ?? null,
        }),
      );
    } catch (e) {
      if (__DEV__) console.warn('[HopeChat] openChatFromNotification', e);
    }
  };
  open();
  return true;
}

function openFromNotificationData(
  raw: Record<string, string>,
  autoAccept = false,
): void {
  let parsed = parseIncomingCallPayload(raw);
  if (!parsed && raw.liveKitRoom) {
    parsed = parseIncomingCallPayload({ ...raw, type: INCOMING_CALL_MESSAGE_TYPE });
  }
  if (!parsed) {
    openChatFromNotification(raw);
    return;
  }
  if (autoAccept) {
    void acceptCallDirectly(parsed);
  } else {
    navigateIncomingCall(parsed);
  }
}

/**
 * True when the user is already reading the chat the notification belongs to —
 * banner-ing a message that is visible on screen would be noise.
 */
function isViewingChat(chatId: string): boolean {
  if (!chatId || !navigationRef.isReady()) return false;
  const current = navigationRef.getCurrentRoute();
  if (current?.name !== 'Inbox') return false;
  const params = current.params as { conversationId?: string } | undefined;
  return String(params?.conversationId ?? '') === String(chatId);
}

/**
 * Registers FCM + Notifee listeners while the user is signed in.
 * Posts the device FCM token to `POST /api/v1/users/fcm-token` so the server can reach this device for incoming calls.
 */
const IncomingCallListener = () => {
  const loggedIn = useAppSelector(selectHopeChatLoggedIn);

  // ── Socket.IO for instant call signaling ──────────────────────────────────
  // Primary channel: sub-100ms delivery when app is foregrounded.
  // FCM remains the fallback for backgrounded/offline devices.
  useEffect(() => {
    if (!loggedIn) return;
    const token = store.getState().auth.token;
    if (!token) return;

    // Pass userId so the socket joins `user_${userId}` and receives personal events
    // (call_cancelled, call_ringing) emitted by the server via io.to(`user_${id}`).
    const authState = store.getState().auth;
    const userId = authState.profile?.userId || String(authState.giftedChatUser?._id ?? '');
    callSocket.connect(token, userId || undefined);

    const unsubIncoming = callSocket.onIncomingCall(data => {
      const parsed = parseIncomingCallPayload(data);
      if (!parsed) return;

      // Acknowledge to the caller that this device received the call and is ringing.
      // This lets the caller's UI switch from "Calling…" to "Ringing…" accurately.
      if (parsed.callerId && parsed.liveKitRoom) {
        callSocket.emitCallRinging(parsed.liveKitRoom, parsed.callerId);
      }

      // Socket path: tear down any existing call BEFORE navigating so the user
      // never sees two call screens simultaneously. await ensures the old room
      // is disconnected and its audio session released before the ringing UI appears.
      const active = getActiveCall();
      // GLARE: both sides dialled each other at the same moment. Room names are
      // derived from the sorted user-id pair, so both computed the SAME room and
      // are already joining each other — this "incoming call" is our own call
      // seen from the other side. Ignore it; ringing here would throw the user
      // out of the call they are already in.
      if (active && active.liveKitRoom === parsed.liveKitRoom) return;
      // A DIFFERENT call while on one: offer it as call waiting rather than
      // tearing the live conversation down without asking.
      if (active) {
        emitCallWaiting(parsed);
        return;
      }
      navigateIncomingCall(parsed);
    });

    const unsubCancelled = callSocket.onCallCancelled(data => {
      const cancelledRoom = data.liveKitRoom || data.room;
      // Withdraw a call-waiting offer if that caller gave up before we answered.
      if (cancelledRoom) emitCallWaitingCleared(cancelledRoom);
      if (cancelledRoom) markCallCancelled(cancelledRoom, callPayloadSentAtMs(data));
      clearAllCallNotifications();
      dismissIncomingCallIfShowing(cancelledRoom);
      endActiveCallIfMatchesRoom(cancelledRoom);
      clearPendingIncomingCall(cancelledRoom);
    });

    return () => {
      unsubIncoming();
      unsubCancelled();
      callSocket.disconnect();
    };
  }, [loggedIn]);

  useEffect(() => {
    if (!loggedIn) return;

    const messaging = getMessaging(getApp());

    let unsubTokenRefresh: (() => void) | undefined;
    const registerRetryTimers: ReturnType<typeof setTimeout>[] = [];

    /**
     * Registering the device token is what puts it in `hopechat_fcm_tokens`
     * server-side. Until that succeeds the backend has no HopeChat token for this
     * user and every call push falls back to the legacy (Hopenity) pool — the
     * call then surfaces as a notification in the wrong app. A single silent
     * attempt was not enough: the first try can 401 while auth is still settling,
     * or fail on a cold network, and nothing retried until the next foreground.
     */
    const REGISTER_RETRY_DELAYS_MS = [2_000, 8_000, 30_000];

    const syncFcmToBackend = async (attempt = 0): Promise<void> => {
      const apiToken = store.getState().auth.token;
      if (!apiToken) return;
      let ok = false;
      try {
        const fcm = await getToken(messaging);
        if (fcm) {
          const r = await postFcmTokenToHopenity(apiToken, fcm);
          ok = r.ok;
          if (!r.ok) {
            console.warn('[HopeChat] FCM token registration failed HTTP', r.status);
          }
        }
      } catch (e) {
        console.warn('[HopeChat] FCM getToken / register', e);
      }

      if (ok) return;
      const delay = REGISTER_RETRY_DELAYS_MS[attempt];
      if (delay == null) return; // give up until the next foreground / network regain
      registerRetryTimers.push(
        setTimeout(() => {
          void syncFcmToBackend(attempt + 1);
        }, delay),
      );
    };

    const unsubNet = NetInfo.addEventListener(state => {
      if (state.isConnected && state.isInternetReachable !== false) {
        consumePendingIncomingCall();
        // Network came back (very often right after a dropped call) — make sure
        // the signaling socket is alive again, otherwise the next incoming call
        // only arrives via the slower FCM path, or not at all.
        const auth = store.getState().auth;
        callSocket.ensureConnected(
          auth.token,
          auth.profile?.userId || String(auth.giftedChatUser?._id ?? ''),
        );
        void syncFcmToBackend();
      }
    });

    const consumePending = () => {
      consumePendingIncomingCall();
      void consumePendingAutoAcceptData().then(json => {
        if (!json) return;
        try {
          const parsed = parseIncomingCallPayload(
            JSON.parse(json) as Record<string, string>,
          );
          // Guard: if a call_cancelled FCM already arrived in-process, don't
          // join a dead LiveKit room.
          if (!parsed || isCallCancelled(parsed.liveKitRoom)) return;
          void acceptCallDirectly(parsed);
        } catch { /* */ }
      });
      void consumePendingRejectData().then(json => {
        if (!json) return;
        try { processRejectPayload(JSON.parse(json) as Record<string, string>); } catch { /* */ }
      });
    };

    // The ongoing-call notification was tapped. This fires whichever context
    // received the press, and — unlike the AppState listener below — it does not
    // require the app to have been backgrounded first. Backing out of the call
    // screen leaves the app 'active', so this is the path that actually runs in
    // the "I'm still in the app, tap the notification to get back" case.
    const unsubOpenCall = DeviceEventEmitter.addListener(
      OPEN_ACTIVE_CALL_EVENT,
      (pending?: PendingCallScreenData) => {
        // Clear the flag so the AppState/mount paths do not fire a second time.
        consumePendingOpenActiveCall();
        const data = consumePendingOpenActiveCallData() ?? pending;
        openActiveCallScreenWhenReady(0, data ?? undefined);
      },
    );

    const unsubAppState = AppState.addEventListener('change', next => {
      if (next === 'active') {
        consumePending();
        // Ongoing-call notification was tapped while backgrounded.
        if (consumePendingOpenActiveCall()) {
        // Pass the recorded call through, so a screen that is no longer in the
        // stack can still be rebuilt rather than the tap doing nothing.
        openActiveCallScreenWhenReady(0, consumePendingOpenActiveCallData() ?? undefined);
      }
        const auth = store.getState().auth;
        callSocket.ensureConnected(
          auth.token,
          auth.profile?.userId || String(auth.giftedChatUser?._id ?? ''),
        );
        void syncFcmToBackend();
      }
    });

    let unsubMessage: undefined | (() => void);
    let unsubOpenedApp: undefined | (() => void);
    let unsubNotifee: undefined | (() => void);

    void (async () => {
      await ensureIncomingCallAndroidChannel();

      if (Platform.OS === 'ios') {
        await registerDeviceForRemoteMessages(messaging);
      }

      await requestPermission(messaging);
      const nSettings = await notifee.requestPermission({
        alert: true,
        sound: true,
        badge: true,
      });
      if (
        Platform.OS === 'ios' &&
        nSettings.authorizationStatus === AuthorizationStatus.DENIED
      ) {
        /* Incoming UI still mounts; ringing may rely on vibrations / Android channel */
      }

      // Detect device settings that silently break background calls
      // (notifications off, battery optimization) and guide the user to fix
      // them — the same prompts WhatsApp shows. Delayed so it never competes
      // with the OS permission dialog above.
      setTimeout(() => {
        void ensureCallReliability();
      }, 4_000);

      await syncFcmToBackend();

      // Publish this device's PUBLIC encryption keys so peers can start a
      // session with us while we are offline. Runs alongside FCM registration
      // because both answer the same question — "how do I reach this install?"
      // Cheap after the first launch: the bundle upserts and one-time prekeys
      // are only topped up when they run low.
      {
        const apiToken = store.getState().auth.token;
        if (apiToken) void publishKeys(apiToken);
        // Keep the encrypted history archive current. No-ops unless the vault is
        // unlocked AND something actually changed, so this is nearly free.
        if (apiToken) scheduleArchiveSync(apiToken);
      }

      unsubTokenRefresh = onTokenRefresh(messaging, async newToken => {
        const apiToken = store.getState().auth.token;
        if (apiToken && newToken) {
          await postFcmTokenToHopenity(apiToken, newToken);
        }
      });

      unsubMessage = onMessage(messaging, async remoteMessage => {
        const data = normalizeFcmData(remoteMessage.data);

        // Call cancelled (answered on another device or caller hung up).
        const isCancelled =
          data.type === CALL_CANCELLED_MESSAGE_TYPE ||
          data.type === 'call_cancel' ||
          data.cancelled === '1' ||
          data.cancelled === 'true';
        if (isCancelled) {
          const cancelledRoom = data.liveKitRoom || data.room;
          if (cancelledRoom) emitCallWaitingCleared(cancelledRoom);
          if (cancelledRoom) markCallCancelled(cancelledRoom, callPayloadSentAtMs(data));
          // Stop every ringing/ongoing surface immediately before anything else.
          clearAllCallNotifications();
          dismissIncomingCallIfShowing(cancelledRoom);
          endActiveCallIfMatchesRoom(cancelledRoom);
          // Kill any buffered pending navigation that hasn't fired yet — prevents
          // the IncomingCallScreen from opening after nav becomes ready.
          clearPendingIncomingCall(cancelledRoom);
          return;
        }

        const parsed = parseIncomingCallPayload(data);
        if (parsed) {
          // Tear down any existing call before navigating so the user never sees
          // two call screens at once (mirrors the socket path above).
          const active = getActiveCall();
          // Same glare rule as the socket path above.
          if (active && active.liveKitRoom === parsed.liveKitRoom) {
            /* our own call, seen from the other side — ignore */
          } else if (active) {
            emitCallWaiting(parsed);
          } else {
            navigateIncomingCall(parsed);
          }
        } else {
          // Non-call notification (new chat message, request, etc.) — refresh inbox.
          if (Object.keys(data).length > 0) {
            DeviceEventEmitter.emit(RELOAD_CHAT_LIST_EVENT);
          }
          // Foreground messages used to be silent: FCM only auto-displays while
          // backgrounded, so an incoming chat produced no banner at all. Render
          // the same Messenger-style notification here, unless the user is
          // already looking at that conversation.
          if (!isViewingChat(notificationChatId(data))) {
            void displayMessagingNotification(data).catch(() => undefined);
          }
          if (__DEV__ && Object.keys(data).length > 0) {
            console.log(
              '[HopeChat] FCM non-call message → reloading chat list',
              Object.keys(data),
            );
          }
        }
      });

      unsubOpenedApp = onNotificationOpenedApp(messaging, remoteMessage => {
        const data = normalizeFcmData(remoteMessage?.data);
        // Always refresh inbox when opening from a notification (could be a new message).
        DeviceEventEmitter.emit(RELOAD_CHAT_LIST_EVENT);
        openFromNotificationData(data);
      });

      const initial = await getInitialNotification(messaging);
      if (initial?.data) {
        openFromNotificationData(normalizeFcmData(initial.data));
      }

      const notInitial = await notifee.getInitialNotification();
      if (notInitial?.notification?.id === ONGOING_NOTIFICATION_ID) {
        openActiveCallScreenWhenReady(
          0,
          notInitial.notification.data as Record<string, string> | undefined,
        );
      } else if (notInitial?.notification?.data) {
        const wasAcceptButton = notInitial.pressAction?.id === 'accept';
        openFromNotificationData(
          notInitial.notification.data as Record<string, string>,
          wasAcceptButton,
        );
      }

      unsubNotifee = notifee.onForegroundEvent(({ type, detail }) => {
        if (type !== EventType.PRESS) return;

        // "Hang up" on the in-progress call notification.
        if (detail.pressAction?.id === HANGUP_ACTION_ID) {
          // Ends the room AND leaves the call screen, and the registry's
          // teardown signals the peer over both channels.
          //
          // The registry is the preferred source, but it is EMPTY whenever the
          // call screen is not mounted — during connect, and after the user
          // backs out of a running call. Falling back to the room the
          // notification carries is what makes Hang up work in exactly those
          // cases, where previously it silently did nothing on both ends.
          const notifRoom = String(
            (detail.notification?.data as Record<string, string> | undefined)
              ?.liveKitRoom ?? '',
          ).trim();
          const room = getActiveCall()?.liveKitRoom || notifRoom;
          void hangUpOngoingCall(room);
          return;
        }

        // Ongoing call notification tapped — bring the active call screen back into view.
        if (detail.notification?.id === ONGOING_NOTIFICATION_ID) {
          openActiveCallScreenWhenReady(
            0,
            detail.notification?.data as Record<string, string> | undefined,
          );
          return;
        }

        if (!detail.notification?.data) return;
        const actionId = detail.pressAction?.id;
        const data = detail.notification.data as Record<string, string>;

        if (actionId === 'reject') {
          // Reject pressed while app is in foreground — decline immediately.
          stopIncomingCallRingtone();
          void cancelAndroidIncomingCallNotification();
          processRejectPayload(data);
          return;
        }

        openFromNotificationData(data, actionId === 'accept');
      });

      // Also consume on initial mount — the AppState 'change' listener doesn't fire
      // if the app launches directly into the 'active' state (cold-start via notification tap).
      consumePending();
      if (consumePendingOpenActiveCall()) {
        // Pass the recorded call through, so a screen that is no longer in the
        // stack can still be rebuilt rather than the tap doing nothing.
        openActiveCallScreenWhenReady(0, consumePendingOpenActiveCallData() ?? undefined);
      }
    })().catch(() => undefined);

    return () => {
      registerRetryTimers.forEach(clearTimeout);
      unsubTokenRefresh?.();
      unsubNet();
      unsubAppState.remove();
      unsubOpenCall.remove();
      unsubMessage?.();
      unsubOpenedApp?.();
      unsubNotifee?.();
    };
  }, [loggedIn]);

  useEffect(() => {
    if (!__DEV__ || !loggedIn) return;

    (
      globalThis as {
        __HOPE_CHAT_SIMULATE_INCOMING_CALL__?: () => void;
      }
    ).__HOPE_CHAT_SIMULATE_INCOMING_CALL__ = () => {
      navigateIncomingCall({
        callKind: 'audio',
        liveKitRoom: 'dev_incoming_demo',
        displayName: 'Test caller',
        callerId: 'dev',
      });
    };

    return () => {
      const g = globalThis as {
        __HOPE_CHAT_SIMULATE_INCOMING_CALL__?: () => void;
      };
      if (g.__HOPE_CHAT_SIMULATE_INCOMING_CALL__) {
        delete g.__HOPE_CHAT_SIMULATE_INCOMING_CALL__;
      }
    };
  }, [loggedIn]);

  return <CallReliabilityPrompt />;
};

export default IncomingCallListener;
