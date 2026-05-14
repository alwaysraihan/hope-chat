import { NativeModules, Platform } from 'react-native';
import { MMKV } from 'react-native-mmkv';

type NativeOverlay = {
  hasOverlayPermission?: () => Promise<boolean>;
  requestOverlayPermission?: () => Promise<boolean>;
};

const native = NativeModules.HopeChatOverlayPermission as
  | NativeOverlay
  | undefined;

const overlayPrefs = new MMKV({ id: 'hopechat.overlay-permission' });
const PROMPT_OPT_OUT_KEY = 'optOut';

/**
 * Whether the user has granted "Display over other apps". Always `true` on iOS — the OS handles
 * PiP differently and we never need SYSTEM_ALERT_WINDOW.
 */
export async function hasOverlayPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  if (!native?.hasOverlayPermission) return false;
  try {
    return await native.hasOverlayPermission();
  } catch {
    return false;
  }
}

/**
 * Opens Android's per-app overlay-permission settings screen. The promise resolves immediately
 * with `true` if already granted, otherwise `false` once Settings opens — re-check from
 * AppState 'active' to confirm the user toggled it on.
 */
export async function requestOverlayPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  if (!native?.requestOverlayPermission) return false;
  try {
    return await native.requestOverlayPermission();
  } catch {
    return false;
  }
}

export function isOverlayPromptOptedOut(): boolean {
  if (Platform.OS !== 'android') return true;
  return overlayPrefs.getBoolean(PROMPT_OPT_OUT_KEY) === true;
}

export function setOverlayPromptOptedOut(value: boolean): void {
  if (Platform.OS !== 'android') return;
  overlayPrefs.set(PROMPT_OPT_OUT_KEY, value);
}
