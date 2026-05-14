import { useEffect, useRef } from 'react';
import { Alert, Platform } from 'react-native';

import {
  hasOverlayPermission,
  isOverlayPromptOptedOut,
  requestOverlayPermission,
  setOverlayPromptOptedOut,
} from '../services/incomingCall/overlayPermission';

/**
 * Asks for "Display over other apps" once per install (Android only), the first time the user
 * is on a call screen. The actual floating mini-call window is a follow-up; for now this lets
 * us light up the SYSTEM_ALERT_WINDOW gate so we can ship the bubble without another permission
 * dialog. Users who decline are never asked again.
 */
export function useOverlayPermissionPrompt(): void {
  const askedRef = useRef(false);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    if (askedRef.current) return;
    askedRef.current = true;

    let cancelled = false;
    void (async () => {
      try {
        if (isOverlayPromptOptedOut()) return;
        const granted = await hasOverlayPermission();
        if (granted || cancelled) return;
        Alert.alert(
          'Stay on calls while you use other apps',
          'Hope Chat can show a small call bubble over other apps when you minimise. Grant "Display over other apps" to enable it.',
          [
            {
              text: 'Not now',
              style: 'cancel',
            },
            {
              text: 'Never ask',
              style: 'destructive',
              onPress: () => setOverlayPromptOptedOut(true),
            },
            {
              text: 'Open settings',
              onPress: () => {
                void requestOverlayPermission();
              },
            },
          ],
          { cancelable: true },
        );
      } catch {
        /* never throw out of a passive prompt */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);
}
