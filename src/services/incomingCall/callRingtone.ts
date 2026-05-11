import { NativeModules, Platform } from 'react-native';

type NativeRing = {
  startIncomingRingtone?: () => void;
  stopIncomingRingtone?: () => void;
  startOutgoingRingback?: () => void;
  stopOutgoingRingback?: () => void;
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
