import { useRef, useCallback } from 'react';
import type { NavigationProp } from '@react-navigation/native';

/** Avoid double goBack / re-entrancy when LiveKit fires onDisconnected + user action. */
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
        }
      } catch {
        /* ignore */
      }
    }, 0);
  }, [navigation]);
}
