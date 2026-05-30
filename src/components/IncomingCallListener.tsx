import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
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
import { selectHopeChatLoggedIn } from '../redux/features/auth/authSlice';
import { store } from '../redux/store';
import {
  CALL_CANCELLED_MESSAGE_TYPE,
  INCOMING_CALL_MESSAGE_TYPE,
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
import { navigationRef } from '../navigation/navigationRef';
import { postFcmTokenToHopenity } from '../services/registerFcmDeviceToken';
import {
  getActiveCall,
  endActiveCallForReplacement,
} from '../services/livekit/activeCallRegistry';
import { ONGOING_NOTIFICATION_ID } from '../services/livekit/liveKitCallForeground';
import { StackActions, CommonActions } from '@react-navigation/native';
import { emitCallOutcome } from '../services/callOutcomeBus';
import { notifyPeerCallRejected } from '../services/invitePeerToHopeChatCall';

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

function endActiveCallIfMatchesRoom(liveKitRoom?: string): void {
  if (!liveKitRoom) return;
  const active = getActiveCall();
  if (!active || active.liveKitRoom !== liveKitRoom) return;
  void active.leave();
}

/**
 * Accept a call directly — skips IncomingCallScreen entirely so the user lands
 * straight on the call screen with no intermediate flash.
 */
async function acceptCallDirectly(parsed: ReturnType<typeof parseIncomingCallPayload>): Promise<void> {
  if (!parsed || !navigationRef.isReady()) return;
  stopIncomingCallRingtone();
  void cancelAndroidIncomingCallNotification();

  const params = {
    displayName: parsed.displayName ?? '',
    liveKitRoom: parsed.liveKitRoom,
    avatarUrl: parsed.avatarUrl ?? null,
    conversationId: parsed.conversationId,
    peerUserId: parsed.callerId,
    callDirection: 'incoming' as const,
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
    const callIdx = routes.findIndex(r => r.name === targetRoute);
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
  const token = store.getState().auth.token;
  if (token && parsed.liveKitRoom) {
    void notifyPeerCallRejected({
      token,
      conversationId: parsed.conversationId,
      liveKitRoom: parsed.liveKitRoom,
    });
  }
  dismissIncomingCallIfShowing(parsed.liveKitRoom);
}

function openFromNotificationData(
  raw: Record<string, string>,
  autoAccept = false,
): void {
  let parsed = parseIncomingCallPayload(raw);
  if (!parsed && raw.liveKitRoom) {
    parsed = parseIncomingCallPayload({ ...raw, type: INCOMING_CALL_MESSAGE_TYPE });
  }
  if (!parsed) return;
  if (autoAccept) {
    void acceptCallDirectly(parsed);
  } else {
    navigateIncomingCall(parsed);
  }
}

/**
 * Registers FCM + Notifee listeners while the user is signed in.
 * Posts the device FCM token to `POST /api/v1/users/fcm-token` so the server can reach this device for incoming calls.
 */
const IncomingCallListener = () => {
  const loggedIn = useAppSelector(selectHopeChatLoggedIn);

  useEffect(() => {
    if (!loggedIn) return;

    const messaging = getMessaging(getApp());

    let unsubTokenRefresh: (() => void) | undefined;

    const syncFcmToBackend = async () => {
      const apiToken = store.getState().auth.token;
      if (!apiToken) return;
      try {
        const fcm = await getToken(messaging);
        if (fcm) {
          const r = await postFcmTokenToHopenity(apiToken, fcm);
          if (__DEV__ && !r.ok) {
            console.warn('[HopeChat] FCM token registration failed HTTP', r.status);
          }
        }
      } catch (e) {
        if (__DEV__) {
          console.warn('[HopeChat] FCM getToken / register', e);
        }
      }
    };

    const unsubNet = NetInfo.addEventListener(state => {
      if (state.isConnected && state.isInternetReachable !== false) {
        consumePendingIncomingCall();
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
          if (cancelledRoom) markCallCancelled(cancelledRoom);
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
          // Bug 2: if there's an active call in a different room, tear it down
          // immediately so the user isn't stuck in two simultaneous calls while
          // deciding whether to accept the new one.
          const active = getActiveCall();
          if (active && active.liveKitRoom !== parsed.liveKitRoom) {
            void endActiveCallForReplacement(parsed.liveKitRoom);
          }
          navigateIncomingCall(parsed);
        } else if (__DEV__ && Object.keys(data).length > 0) {
          console.warn(
            '[HopeChat] FCM foreground message ignored (not incoming-call payload)',
            Object.keys(data),
          );
        }
      });

      unsubOpenedApp = onNotificationOpenedApp(messaging, remoteMessage => {
        const data = normalizeFcmData(remoteMessage?.data);
        openFromNotificationData(data);
      });

      const initial = await getInitialNotification(messaging);
      if (initial?.data) {
        openFromNotificationData(normalizeFcmData(initial.data));
      }

      const notInitial = await notifee.getInitialNotification();
      if (notInitial?.notification?.data) {
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
          navigateToActiveCallScreen();
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
    })().catch(() => undefined);

    return () => {
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

  return null;
};

export default IncomingCallListener;
