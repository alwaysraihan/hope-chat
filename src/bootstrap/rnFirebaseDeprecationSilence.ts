/**
 * RNFB modular helpers (e.g. getMessaging) still access app.messaging() internally and
 * trip the v22 deprecation proxy until @react-native-firebase is updated.
 * @see https://rnfirebase.io/migrating-to-v22
 *
 * Silence only the noisy console.warn — app code uses modular imports.
 */
(globalThis as { RNFB_SILENCE_MODULAR_DEPRECATION_WARNINGS?: boolean }).RNFB_SILENCE_MODULAR_DEPRECATION_WARNINGS =
  true;
