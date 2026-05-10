import { useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import type { DisconnectReason } from 'livekit-client';

import { describeDisconnectReason } from '../utils/liveKitDisconnectReason';
import type { DisconnectUiAction } from '../utils/liveKitDisconnectReason';
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

  /** If anything in our disconnect UI throws, still leave the call screen. */
  const endCallScreenOnly = useCallback(() => {
    endOnce(() => {});
  }, [endOnce]);

  const onDisconnected = useCallback(
    (reason?: DisconnectReason) => {
      try {
        let ui: DisconnectUiAction;
        try {
          ui = describeDisconnectReason(reason);
        } catch {
          ui = {
            showAlert: false,
            title: '',
            body: '',
            logLabel: 'describeDisconnectReason_failed',
          };
        }
        try {
          console.warn(`[${callLabel}] disconnected`, ui.logLabel, reason);
        } catch {
          /* */
        }
        endOnce(() => {
          if (ui.showAlert) {
            try {
              Alert.alert(ui.title, ui.body);
            } catch {
              /* */
            }
          }
        });
      } catch {
        endCallScreenOnly();
      }
    },
    [callLabel, endOnce, endCallScreenOnly],
  );

  const onError = useCallback(
    (e: Error) => {
      try {
        try {
          console.error(`[${callLabel}] LiveKit onError`, stringifyUnknownError(e));
        } catch {
          /* */
        }
        let dismiss = false;
        try {
          dismiss = shouldDismissCallScreenOnLiveKitError(e);
        } catch {
          dismiss = true;
        }
        if (dismiss) {
          endOnce(() => {
            try {
              Alert.alert(
                'Could not connect',
                shortErrorMessage(e) ||
                  'Check your internet connection and try again.',
              );
            } catch {
              /* */
            }
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
      } catch {
        endCallScreenOnly();
      }
    },
    [callLabel, endOnce, endCallScreenOnly],
  );

  const onEncryptionError = useCallback(
    (e: Error) => {
      try {
        try {
          console.error(
            `[${callLabel}] encryption error`,
            stringifyUnknownError(e),
          );
        } catch {
          /* */
        }
        endOnce(() => {
          try {
            Alert.alert(
              callLabel,
              'Encryption could not be established. The call will end.',
            );
          } catch {
            /* */
          }
        });
      } catch {
        endCallScreenOnly();
      }
    },
    [callLabel, endOnce, endCallScreenOnly],
  );

  /**
   * Microphone / camera could not open — end the call screen so the user is never stuck
   * on a broken native pipeline (still cannot catch native SIGSEGV).
   */
  const forceEndCallWithAlert = useCallback(
    (title: string, body: string) => {
      endOnce(() => {
        try {
          Alert.alert(title, body);
        } catch {
          /* */
        }
      });
    },
    [endOnce],
  );

  return {
    onDisconnected,
    onError,
    onEncryptionError,
    forceEndCallWithAlert,
  };
}
