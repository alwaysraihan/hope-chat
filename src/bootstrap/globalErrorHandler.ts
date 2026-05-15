/**
 * Suppress fatal JS errors in production so the app never white-screens.
 *
 * ErrorUtils is a React Native internal global — it is NOT exported from
 * 'react-native' reliably. This file must never throw under any circumstance,
 * so the whole setup is wrapped in try-catch and uses `any` to avoid TypeScript
 * narrowing issues.
 */
try {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const eu: any = (global as any).ErrorUtils;
  if (eu && typeof eu.setGlobalHandler === 'function') {
    eu.setGlobalHandler((error: Error, isFatal?: boolean) => {
      try {
        if (__DEV__) {
          console.error(
            `[GlobalError] ${isFatal ? 'FATAL' : 'non-fatal'}:`,
            error?.message ?? error,
            error?.stack ?? '',
          );
          throw error;
        } else {
          console.error(
            `[GlobalError] ${isFatal ? 'FATAL' : 'non-fatal'}:`,
            error?.message ?? String(error),
          );
        }
      } catch (inner) {
        if (__DEV__) throw inner;
      }
    });
  }
} catch {
  // ErrorUtils unavailable on this RN version/architecture — silently skip.
}
