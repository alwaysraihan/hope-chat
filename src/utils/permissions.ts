import { Platform, Alert, Linking } from 'react-native';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';

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
