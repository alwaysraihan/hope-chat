/**
 * Must run at app startup on Android so Notifee can keep a foreground service during LiveKit calls.
 */
import { Platform } from 'react-native';
import notifee from '@notifee/react-native';

if (Platform.OS === 'android') {
  notifee.registerForegroundService(() => {
    return new Promise<void>(() => {});
  });
}
