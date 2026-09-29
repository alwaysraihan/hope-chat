/** Optional wrapper around react-native-keep-awake.
 *  Run `npm i react-native-keep-awake` (already in package.json) then rebuild to activate. */

// eslint-disable-next-line no-var
declare var require: (id: string) => unknown;

type KeepAwakeModule = { activate?: unknown; deactivate?: unknown } | null;

/**
 * react-native-keep-awake ships an ES default export (a component class with
 * static activate/deactivate), so `require()` hands back `{ default: KeepAwake }`
 * under Babel's interop rather than the class itself. Unwrap it, and treat a
 * missing method as "not installed" — calling `mod?.activate()` on the wrapper
 * throws "undefined is not a function" and takes the whole call screen down.
 */
import { setNativeKeepScreenOn } from '../services/incomingCall/callRingtone';

let mod: KeepAwakeModule = null;
try {
  const required = require('react-native-keep-awake') as
    | { default?: KeepAwakeModule }
    | KeepAwakeModule;
  const resolved =
    (required as { default?: KeepAwakeModule } | null)?.default ??
    (required as KeepAwakeModule);
  mod = typeof resolved?.activate === 'function' ? resolved : null;
} catch {
  /* package not installed yet */
}

let warnedUnavailable = false;

/** True when the native keep-awake module actually resolved. */
export function isKeepAwakeAvailable(): boolean {
  return mod != null;
}

function invoke(name: 'activate' | 'deactivate'): void {
  const fn = mod?.[name];
  if (typeof fn !== 'function') {
    // Silence here meant a video call could let the screen sleep with nothing
    // anywhere to explain why. Report it once so it is diagnosable from a log
    // instead of being mistaken for a device setting.
    if (!warnedUnavailable) {
      warnedUnavailable = true;
      console.warn(
        '[keepAwake] react-native-keep-awake is not linked — the screen WILL sleep during video calls',
      );
    }
    return;
  }
  try {
    (fn as () => void).call(mod);
  } catch {
    // Keeping the screen awake is best-effort — never break the call screen.
  }
}

/**
 * Keep the screen on.
 *
 * Prefers the app's own native module (FLAG_KEEP_SCREEN_ON on the activity
 * window) and only falls back to react-native-keep-awake. The package is
 * unmaintained and its wrapper fails silently when unlinked, which would let a
 * video call sleep the screen with nothing to explain it — too important to
 * leave to a third-party binding.
 */
export function activateKeepAwake(): void {
  if (setNativeKeepScreenOn(true)) return;
  invoke('activate');
}

export function deactivateKeepAwake(): void {
  if (setNativeKeepScreenOn(false)) return;
  invoke('deactivate');
}
