import { useRef, useCallback } from 'react';
import type { NavigationProp } from '@react-navigation/native';

import { navigationRef } from '../navigation/navigationRef';

/**
 * Avoid double goBack / re-entrancy when LiveKit fires onDisconnected + user action.
 * If goBack is impossible (broken stack / deep link), reset to Home so the app never
 * stays stuck on a dying call screen.
 */
export function useSafeSingleNavigationPop(
  navigation: NavigationProp<Record<string, unknown>>,
) {
  const popped = useRef(false);
  return useCallback(() => {
    if (popped.current) return;
    popped.current = true;
    setTimeout(() => {
      try {
        if (navigation.canGoBack()) {
          navigation.goBack();
          return;
        }
      } catch {
        /* fall through to ref-based escape */
      }
      try {
        if (navigationRef.isReady()) {
          navigationRef.navigate('BottomTab', { screen: 'Home' });
        }
      } catch {
        /* last resort: swallow — never rethrow into React or native bridge */
      }
    }, 0);
  }, [navigation]);
}
