import { useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import type { DisconnectReason } from 'livekit-client';

import { describeDisconnectReason } from '../utils/liveKitDisconnectReason';
import { shortErrorMessage, stringifyUnknownError } from '../utils/liveKitErrorFormat';
import { shouldDismissCallScreenOnLiveKitError } from '../utils/liveKitErrorPolicy';

type Options = {
  /** Label for logs / alerts, e.g. `Video call` */
  callLabel: string;
  safePop: () => void;
};

/**
 * Coordinates `LiveKitRoom` `onDisconnected(reason)` and `onError` so we never double-pop,
 * and only dismiss the screen on connection failures — not on camera/mic publish glitches.
 */
export function useLiveKitSessionEnd({ callLabel, safePop }: Options) {
  const sessionEnded = useRef(false);

  const endOnce = useCallback(
    (body: () => void) => {
      if (sessionEnded.current) {
        return;
      }
      sessionEnded.current = true;
      try {
        body();
      } catch {
        /* Alert / navigation must never throw out of handlers */
      }
      try {
        safePop();
      } catch {
        /* useSafeSingleNavigationPop is defensive */
      }
    },
    [safePop],
  );

  const onDisconnected = useCallback(
    (reason?: DisconnectReason) => {
      const ui = describeDisconnectReason(reason);
      try {
        console.warn(`[${callLabel}] disconnected`, ui.logLabel, reason);
      } catch {
        /* */
      }
      endOnce(() => {
        if (ui.showAlert) {
          Alert.alert(ui.title, ui.body);
        }
      });
    },
    [callLabel, endOnce],
  );

  const onError = useCallback(
    (e: Error) => {
      try {
        console.error(`[${callLabel}] LiveKit onError`, stringifyUnknownError(e));
      } catch {
        /* */
      }
      if (shouldDismissCallScreenOnLiveKitError(e)) {
        endOnce(() => {
          Alert.alert(
            'Could not connect',
            shortErrorMessage(e) ||
              'Check your internet connection and try again.',
          );
        });
        return;
      }
      try {
        Alert.alert(
          callLabel,
          shortErrorMessage(e) ||
            'A media error occurred. You can keep trying or end the call.',
        );
      } catch {
        /* */
      }
    },
    [callLabel, endOnce],
  );

  const onEncryptionError = useCallback(
    (e: Error) => {
      try {
        console.error(
          `[${callLabel}] encryption error`,
          stringifyUnknownError(e),
        );
      } catch {
        /* */
      }
      endOnce(() => {
        Alert.alert(
          callLabel,
          'Encryption could not be established. The call will end.',
        );
      });
    },
    [callLabel, endOnce],
  );

  return { onDisconnected, onError, onEncryptionError };
}
