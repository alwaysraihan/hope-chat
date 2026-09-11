import { useCallback, useRef } from 'react';
import type { NavigationProp } from '@react-navigation/native';

import { navigationRef } from '../navigation/navigationRef';

const RETRY_DELAY_MS = 300;
const MAX_ATTEMPTS = 12; // ~3.6s worst case before giving up

/**
 * Avoid double goBack / re-entrancy when LiveKit fires onDisconnected + user action.
 * If goBack is impossible (broken stack / deep link), reset to Home so the app never
 * stays stuck on a dying call screen.
 */
export function useSafeSingleNavigationPop(
  navigation: NavigationProp<Record<string, unknown>>,
) {
  const popped = useRef(false);
  const attempts = useRef(0);

  const attempt = useCallback(() => {
    if (popped.current) return;
    try {
      if (navigation.canGoBack()) {
        popped.current = true;
        navigation.goBack();
        return;
      }
    } catch {
      /* fall through to ref-based escape */
    }
    try {
      if (navigationRef.isReady()) {
        popped.current = true;
        navigationRef.navigate('BottomTab', { screen: 'Home' });
        return;
      }
    } catch {
      /* fall through to retry */
    }
    // Neither path was available yet (navigator still mounting / mid-transition
    // / not ready). This used to mark `popped` true regardless and give up
    // silently here, which is what left the "Call ended" screen stuck forever
    // on the unlucky timing. Retry instead, up to a bounded number of times.
    attempts.current += 1;
    if (attempts.current >= MAX_ATTEMPTS) {
      // Last resort: a hard reset always succeeds once the navigator is ready,
      // even if goBack()/navigate() kept silently failing above. Without this,
      // exhausting retries left the call screen stuck forever with no escape.
      try {
        if (navigationRef.isReady()) {
          popped.current = true;
          navigationRef.reset({
            index: 0,
            routes: [{ name: 'BottomTab', params: { screen: 'Home' } }],
          });
          return;
        }
      } catch {
        /* fall through */
      }
      setTimeout(attemptRef.current, RETRY_DELAY_MS);
      return;
    }
    setTimeout(attemptRef.current, RETRY_DELAY_MS);
  }, [navigation]);

  const attemptRef = useRef(attempt);
  attemptRef.current = attempt;

  return useCallback(() => {
    setTimeout(() => attemptRef.current(), 0);
  }, []);
}
