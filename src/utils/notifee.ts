import notifee, { AndroidImportance } from '@notifee/react-native';
import { FirebaseMessagingTypes } from '@react-native-firebase/messaging';

async function createChannelOnce() {
  await notifee.createChannel({
    id: 'default',
    name: 'Default Channel',
    importance: AndroidImportance.HIGH,
  });
}

async function onMessageReceived(message: FirebaseMessagingTypes.RemoteMessage) {
  const { title, body } = message.notification || {};

  await notifee.displayNotification({
    title,
    body,
    android: {
      channelId: 'default',
    },
    data: message.data,
  });
}

export { createChannelOnce, onMessageReceived };
