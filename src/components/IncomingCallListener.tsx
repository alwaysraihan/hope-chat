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
  INCOMING_CALL_MESSAGE_TYPE,
  normalizeFcmData,
  parseIncomingCallPayload,
} from '../services/incomingCall/payload';
import {
  consumePendingIncomingCall,
  navigateIncomingCall,
} from '../services/incomingCall/navigateIncomingCall';
import { ensureIncomingCallAndroidChannel } from '../services/incomingCall/androidIncomingCallUi';
import { postFcmTokenToHopenity } from '../services/registerFcmDeviceToken';

function openFromNotificationData(raw: Record<string, string>): void {
  let parsed = parseIncomingCallPayload(raw);
  if (!parsed && raw.liveKitRoom) {
    parsed = parseIncomingCallPayload({
      ...raw,
      type: INCOMING_CALL_MESSAGE_TYPE,
    });
  }
  if (parsed) navigateIncomingCall(parsed);
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

    const unsubAppState = AppState.addEventListener('change', next => {
      if (next === 'active') {
        consumePendingIncomingCall();
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
        const parsed = parseIncomingCallPayload(data);
        if (parsed) {
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
        openFromNotificationData(
          notInitial.notification.data as Record<string, string>,
        );
      }

      unsubNotifee = notifee.onForegroundEvent(({ type, detail }) => {
        if (type !== EventType.PRESS || !detail.notification?.data) return;
        openFromNotificationData(
          detail.notification.data as Record<string, string>,
        );
      });

      consumePendingIncomingCall();
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
