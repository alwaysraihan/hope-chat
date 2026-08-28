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
