import { NativeModules, Platform } from 'react-native';

import {
  readPendingAutoAccept,
  readPendingReject,
  writePendingAutoAccept,
  writePendingReject,
} from './pendingCallAction';

type NativeRing = {
  startIncomingRingtone?: () => void;
  stopIncomingRingtone?: () => void;
  startOutgoingRingback?: () => void;
  stopOutgoingRingback?: () => void;
  setPendingAutoAcceptData?: (json: string) => void;
  consumePendingAutoAcceptData?: () => Promise<string | null>;
  setKeepScreenOn?: (on: boolean) => void;
  setPendingRejectData?: (json: string) => void;
  consumePendingRejectData?: () => Promise<string | null>;
};

const native = NativeModules.HopeChatCallRingtone as NativeRing | undefined;

/** Play system/default ringtone (Android: looping Ringtone; iOS: alert + vibration loop). */
export function startIncomingCallRingtone(): void {
  native?.startIncomingRingtone?.();
  if (__DEV__ && Platform.OS !== 'android' && Platform.OS !== 'ios') {
    console.warn('[HopeChatCallRingtone] unsupported platform');
  }
}

export function stopIncomingCallRingtone(): void {
  native?.stopIncomingRingtone?.();
}

/** Outgoing call: ring-back while waiting for the other party (WhatsApp-style). */
export function startOutgoingCallRingback(): void {
  native?.startOutgoingRingback?.();
}

export function stopOutgoingCallRingback(): void {
  native?.stopOutgoingRingback?.();
}

/**
 * Store JSON call data from the background FCM accept-action handler.
 * The native module is shared across the headless-JS context and the main app process,
 * so this data survives until the main app reads it via consumePendingAutoAcceptData().
 * Android-only; no-op on iOS.
 */
export function setPendingAutoAcceptData(json: string): void {
  if (Platform.OS !== 'android') return;
  // Write BOTH: the native module when it is present, and MMKV always. The
  // native call is optional-chained, so on its own a missing module makes this
  // a silent no-op and the Accept button appears to do nothing.
  native?.setPendingAutoAcceptData?.(json);
  writePendingAutoAccept(json);
}

/**
 * Reads and clears the pending auto-accept JSON set by setPendingAutoAcceptData.
 * Returns null if nothing is pending. Call this when the app comes to foreground.
 */
export async function consumePendingAutoAcceptData(): Promise<string | null> {
  if (Platform.OS !== 'android') return null;
  let fromNative: string | null = null;
  try {
    fromNative = (await native?.consumePendingAutoAcceptData?.()) ?? null;
  } catch {
    fromNative = null;
  }
  // Always drain MMKV too, so a value written there can never be left behind to
  // fire against a later, unrelated call.
  const fromStore = readPendingAutoAccept();
  return fromNative ?? fromStore;
}

/**
 * Discard any stored auto-accept data (e.g. call_cancelled FCM arrived before
 * the main app foregrounded and could consume it).
 */
export async function clearPendingAutoAcceptData(): Promise<void> {
  // consume-and-discard is the only way to clear native storage without adding
  // a new native API.
  await consumePendingAutoAcceptData();
}

export function setPendingRejectData(json: string): void {
  if (Platform.OS !== 'android') return;
  native?.setPendingRejectData?.(json);
  writePendingReject(json);
}

export async function consumePendingRejectData(): Promise<string | null> {
  if (Platform.OS !== 'android') return null;
  let fromNative: string | null = null;
  try {
    fromNative = (await native?.consumePendingRejectData?.()) ?? null;
  } catch {
    fromNative = null;
  }
  const fromStore = readPendingReject();
  return fromNative ?? fromStore;
}

/**
 * Hold the device screen on (Android FLAG_KEEP_SCREEN_ON). Used for video calls.
 * Returns whether the native path was available, so the caller can fall back.
 */
export function setNativeKeepScreenOn(on: boolean): boolean {
  if (Platform.OS !== 'android') return false;
  const fn = native?.setKeepScreenOn;
  if (typeof fn !== 'function') return false;
  try {
    fn(on);
    return true;
  } catch {
    return false;
  }
}
