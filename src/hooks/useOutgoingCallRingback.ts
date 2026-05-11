import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import {
  startOutgoingCallRingback,
  stopOutgoingCallRingback,
} from '../services/incomingCall/callRingtone';

/**
 * WhatsApp-style ringback while the callee has not joined the room (and during SFU connect).
 * Stops automatically when `shouldPlay` becomes false or the component unmounts.
 */
export function useOutgoingCallRingback(shouldPlay: boolean): void {
  const shouldRef = useRef(shouldPlay);
  shouldRef.current = shouldPlay;

  useEffect(() => {
    if (shouldPlay) {
      startOutgoingCallRingback();
    } else {
      stopOutgoingCallRingback();
    }
    return () => {
      stopOutgoingCallRingback();
    };
  }, [shouldPlay]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active' && shouldRef.current) {
        startOutgoingCallRingback();
      }
    });
    return () => sub.remove();
  }, []);
}
