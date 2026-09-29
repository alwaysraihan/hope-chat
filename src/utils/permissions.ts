import { Platform, Alert, Linking } from 'react-native';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';

const MIC_PERMISSION = Platform.select({
  ios: PERMISSIONS.IOS.MICROPHONE,
  android: PERMISSIONS.ANDROID.RECORD_AUDIO,
});

const CAMERA_PERMISSION = Platform.select({
  ios: PERMISSIONS.IOS.CAMERA,
  android: PERMISSIONS.ANDROID.CAMERA,
});

/**
 * Android 12+ (API 31) runtime-gates Bluetooth device access behind
 * BLUETOOTH_CONNECT. It is declared in the manifest but was never requested, so
 * routing call audio to a headset/earbuds/car silently failed on every modern
 * Android device — the output picker could list Bluetooth and still not switch.
 *
 * Asked ON DEMAND, the moment the user picks the Bluetooth output — the way
 * WhatsApp and Messenger do it. Prompting during the call pre-flight instead
 * put a "connect to nearby devices?" dialog in front of every call, which reads
 * as unrelated to calling and trains people to decline.
 *
 * Never blocks: a device with no Bluetooth, or a user who declines, keeps
 * calling over earpiece and speaker exactly as before. Below API 31
 * react-native-permissions reports UNAVAILABLE, ignored like any other refusal.
 *
 * Returns whether Bluetooth access is usable, so the caller can skip a routing
 * attempt that would silently fail.
 */
export async function ensureBluetoothAudioPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const perm = PERMISSIONS.ANDROID.BLUETOOTH_CONNECT;
    if (!perm) return true;
    // Only DENIED can still show a prompt; GRANTED needs nothing and BLOCKED /
    // UNAVAILABLE make request() a silent no-op, so this asks at most once.
    const result = await check(perm);
    if (result === RESULTS.GRANTED) return true;
    // UNAVAILABLE means the OS predates the runtime permission (< API 31),
    // where Bluetooth routing works without asking.
    if (result === RESULTS.UNAVAILABLE) return true;
    if (result !== RESULTS.DENIED) return false;
    return (await request(perm)) === RESULTS.GRANTED;
  } catch (e) {
    if (__DEV__) console.warn('[permissions] bluetooth', e);
    // Permissions module unavailable — let the routing attempt decide.
    return true;
  }
}

export const checkMicrophonePermission = async (): Promise<boolean> => {
  const permission = Platform.select({
    ios: PERMISSIONS.IOS.MICROPHONE,
    android: PERMISSIONS.ANDROID.RECORD_AUDIO,
  });

  if (!permission) {
    console.error('Microphone permission not available for this platform');
    return false;
  }

  try {
    const result = await check(permission);

    if (result === RESULTS.GRANTED) {
      return true;
    }

    if (result === RESULTS.DENIED) {
      const permissionResult = await request(permission);
      return permissionResult === RESULTS.GRANTED;
    }

    if (result === RESULTS.BLOCKED) {
      Alert.alert(
        'Permission Required',
        'Microphone permission is required to record voice messages. Please enable it in app settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ],
      );
      return false;
    }

    return false;
  } catch (error) {
    console.error('Error checking microphone permission:', error);
    return false;
  }
};

export const checkCameraPermission = async (): Promise<boolean> => {
  const permission =
    Platform.OS === 'ios' ? PERMISSIONS.IOS.CAMERA : PERMISSIONS.ANDROID.CAMERA;

  const result = await request(permission);

  if (result === RESULTS.GRANTED) {
    console.log('Permission granted');
    return true;
  } else {
    console.log('Permission denied');
    return false;
  }
};

// ─── Call pre-flight ──────────────────────────────────────────────────────────

/**
 * Ask for the permissions a call needs *before* the call screen mounts.
 *
 * Without this, the first prompt is raised implicitly by getUserMedia inside
 * LiveKit once the room is already connecting, so a denial surfaces as a
 * SecurityError that tears the call screen down instead of a clean message.
 */
let callPermissionInFlight: Promise<boolean> | null = null;

export function ensureCallPermissions(
  kind: 'audio' | 'video',
): Promise<boolean> {
  // Double-taps on the call button would otherwise stack two OS prompts and
  // two Alerts on top of each other.
  if (callPermissionInFlight) return callPermissionInFlight;
  callPermissionInFlight = runCallPermissionChecks(kind).finally(() => {
    callPermissionInFlight = null;
  });
  return callPermissionInFlight;
}

async function runCallPermissionChecks(
  kind: 'audio' | 'video',
): Promise<boolean> {
  const needed =
    kind === 'video'
      ? [
          { perm: MIC_PERMISSION, label: 'Microphone' },
          { perm: CAMERA_PERMISSION, label: 'Camera' },
        ]
      : [{ perm: MIC_PERMISSION, label: 'Microphone' }];

  for (const { perm, label } of needed) {
    if (!perm) continue;

    let result: string;
    try {
      result = await check(perm);
      if (result === RESULTS.DENIED) result = await request(perm);
    } catch (e) {
      // The permissions module itself failed (handler not compiled, native
      // error). Don't strand the user — let the call proceed and let LiveKit
      // raise the system prompt as it did before this pre-flight existed.
      if (__DEV__) console.warn('[permissions] call pre-flight', label, e);
      continue;
    }

    if (result === RESULTS.GRANTED || result === RESULTS.LIMITED) continue;

    if (result === RESULTS.UNAVAILABLE) {
      // No such hardware on this device — e.g. the iOS Simulator has no camera.
      Alert.alert(
        `${label} unavailable`,
        `This device has no ${label.toLowerCase()}, so ${
          kind === 'video' ? 'video calls' : 'calls'
        } can't start here.`,
      );
      return false;
    }

    // BLOCKED — a re-request is a silent no-op, only Settings can undo it.
    Alert.alert(
      `${label} permission needed`,
      `Hope Chat needs ${label.toLowerCase()} access to start ${
        kind === 'video' ? 'a video call' : 'a call'
      }. Enable it in app settings.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Settings',
          onPress: () => {
            Linking.openSettings().catch(() => {});
          },
        },
      ],
    );
    return false;
  }

  return true;
}
