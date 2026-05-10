import { getToken, getMessaging } from '@react-native-firebase/messaging';

const getFcmToken = async () => {
  const messaging = getMessaging();
  const fcmToken = await getToken(messaging);
  console.log({ fcmToken });
  return fcmToken;
};

export default getFcmToken;
