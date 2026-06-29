/** Optional wrapper around react-native-keep-awake.
 *  Run `npm i react-native-keep-awake` (already in package.json) then rebuild to activate. */

// eslint-disable-next-line no-var
declare var require: (id: string) => unknown;

type KeepAwakeModule = { activate(): void; deactivate(): void } | null;

let mod: KeepAwakeModule = null;
try {
  mod = require('react-native-keep-awake') as KeepAwakeModule;
} catch { /* package not installed yet */ }

export function activateKeepAwake(): void {
  mod?.activate();
}

export function deactivateKeepAwake(): void {
  mod?.deactivate();
}
