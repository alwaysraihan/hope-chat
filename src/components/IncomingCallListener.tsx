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
import {
  getActiveCall,
  endActiveCallForReplacement,
  endActiveCallForRemoteHangup,
} from '../services/livekit/activeCallRegistry';
import { ONGOING_NOTIFICATION_ID } from '../services/livekit/liveKitCallForeground';
import { consumePendingOpenActiveCall } from '../services/livekit/pendingCallScreenOpen';
import { StackActions, CommonActions } from '@react-navigation/native';
import { emitCallOutcome } from '../services/callOutcomeBus';
import { notifyPeerCallRejected } from '../services/invitePeerToHopeChatCall';
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
      // Call screen isn't in the stack (shouldn't happen, but fall back to pushing it).
      navigationRef.dispatch(StackActions.push(targetRoute));
      return;
    }
    const popCount = routes.length - 1 - callIdx;
    if (popCount > 0) {
      navigationRef.dispatch(StackActions.pop(popCount));
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
function openActiveCallScreenWhenReady(attempt = 0): void {
  if (attempt > 20) return;
  if (!navigationRef.isReady() || !getActiveCall()) {
    setTimeout(() => openActiveCallScreenWhenReady(attempt + 1), 150);
    return;
  }
  navigateToActiveCallScreen();
}

/**
 * Process a pending reject: emit the missed-call outcome so the server is
 * notified and sends a cancel FCM to the caller.
 */
function processRejectPayload(raw: Record<string, string>): void {
  const parsed = parseIncomingCallPayload(raw);
  if (!parsed?.conversationId || !parsed?.callerId) return;
  emitCallOutcome({
    conversationId: parsed.conversationId,
    callKind: parsed.callKind,
    variant: 'incoming_missed',
    peerUserId: parsed.callerId,
    peerDisplayName: parsed.displayName,
  });
  // Signal the backend so it sends a call_cancelled FCM to the caller, stopping
  // their outgoing ring immediately instead of waiting up to 60s for the timeout.
  // Group calls: one member declining must NOT cancel the call for everyone —
  // other members can still answer, so only dismiss locally.
  const token = store.getState().auth.token;
  if (token && parsed.liveKitRoom && !parsed.isGroupCall) {
    void notifyPeerCallRejected({
      token,
      conversationId: parsed.conversationId,
      liveKitRoom: parsed.liveKitRoom,
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
      // Already on a call? Offer the new one as call waiting instead of tearing
      // the live conversation down without asking. CallWaitingBanner decides.
      const active = getActiveCall();
      if (active && active.liveKitRoom !== parsed.liveKitRoom) {
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
      stopIncomingCallRingtone();
      void cancelAndroidIncomingCallNotification();
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

    const unsubAppState = AppState.addEventListener('change', next => {
      if (next === 'active') {
        consumePending();
        // Ongoing-call notification was tapped while backgrounded.
        if (consumePendingOpenActiveCall()) openActiveCallScreenWhenReady();
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
          // Stop any in-process ringtone immediately before anything else.
          stopIncomingCallRingtone();
          void cancelAndroidIncomingCallNotification();
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
          if (active && active.liveKitRoom !== parsed.liveKitRoom) {
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
        openActiveCallScreenWhenReady();
      } else if (notInitial?.notification?.data) {
        const wasAcceptButton = notInitial.pressAction?.id === 'accept';
        openFromNotificationData(
          notInitial.notification.data as Record<string, string>,
          wasAcceptButton,
        );
      }

      unsubNotifee = notifee.onForegroundEvent(({ type, detail }) => {
        if (type !== EventType.PRESS) return;

        // Ongoing call notification tapped — bring the active call screen back into view.
        if (detail.notification?.id === ONGOING_NOTIFICATION_ID) {
          openActiveCallScreenWhenReady();
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
      if (consumePendingOpenActiveCall()) openActiveCallScreenWhenReady();
    })().catch(() => undefined);

    return () => {
      registerRetryTimers.forEach(clearTimeout);
      unsubTokenRefresh?.();
      unsubNet();
      unsubAppState.remove();
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
