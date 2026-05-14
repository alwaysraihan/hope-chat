import { ErrorUtils } from 'react-native';

/**
 * Suppress fatal JS errors in production so the app never white-screens.
 * Errors are always logged to the console for crash-reporting / debugging.
 */
ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
  if (__DEV__) {
    // In dev, print clearly and let the red-box take over.
    console.error(
      `[GlobalError] ${isFatal ? 'FATAL' : 'non-fatal'}:`,
      error?.message ?? error,
      error?.stack ?? '',
    );
    // Re-throw so Metro / LogBox still shows the red-box.
    throw error;
  } else {
    // In production: log but swallow so the app stays alive.
    console.error(
      `[GlobalError] ${isFatal ? 'FATAL' : 'non-fatal'}:`,
      error?.message ?? String(error),
    );
  }
});
