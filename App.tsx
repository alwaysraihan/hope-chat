import React, { useEffect } from 'react';
import { PermissionsAndroid, Linking } from 'react-native';
PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
import { LinkingOptions, NavigationContainer } from '@react-navigation/native';
import RootNavigator from './src/navigation/RootNavigator';
import { SystemBars } from 'react-native-edge-to-edge';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Provider } from 'react-redux';
import { store } from './src/redux/store';
import PublicStackNavigator from './src/navigation/PublicStackNavigator';
import { useAppSelector } from './src/hooks/redux';
import { selectToken } from './src/redux/features/auth/authSlice';
import messaging, {
  getMessaging,
  onMessage,
} from '@react-native-firebase/messaging';
import getFcmToken from './src/utils/fcmToken';
import { createChannelOnce, onMessageReceived } from './src/utils/notifee';
import { RootStackNavigatorParamList } from './src/types/navigators';

const NAVIGATION_IDS = ['inbox'];

function buildDeepLinkFromNotificationData(data): string | null {
  const navigationId = data?.navigationId;
  if (!NAVIGATION_IDS.includes(navigationId)) {
    console.warn('Unverified navigationId', navigationId);
    return null;
  }

  const conversationId = data?.conversationId;
  if (typeof conversationId === 'string') {
    return `myapp://inbox/${conversationId}`;
  }

  return null;
}

const linking: LinkingOptions<RootStackNavigatorParamList> = {
  prefixes: ['myapp://'],
  config: {
    initialRouteName: 'BottomTab',
    screens: {
      Inbox: 'inbox/:conversationId',
    },
  },
  async getInitialURL() {
    const url = await Linking.getInitialURL();
    if (typeof url === 'string') {
      return url;
    }
    //getInitialNotification: When the application is opened from a quit state.
    const message = await messaging().getInitialNotification();
    const deeplinkURL = buildDeepLinkFromNotificationData(message?.data);
    if (typeof deeplinkURL === 'string') {
      return deeplinkURL;
    }
  },
  subscribe(listener: (url: string) => void) {
    const onReceiveURL = ({ url }: { url: string }) => listener(url);

    // Listen to incoming links from deep linking
    const linkingSubscription = Linking.addEventListener('url', onReceiveURL);

    //onNotificationOpenedApp: When the application is running, but in the background.
    const unsubscribe = messaging().onNotificationOpenedApp(remoteMessage => {
      const url = buildDeepLinkFromNotificationData(remoteMessage.data);
      if (typeof url === 'string') {
        listener(url);
      }
    });

    return () => {
      linkingSubscription.remove();
      unsubscribe();
    };
  },
};

const AppInner = () => {
  useEffect(() => {
    createChannelOnce();
    const m = getMessaging();
    const unsubscribe = onMessage(m, onMessageReceived);

    return unsubscribe;
  }, []);
  getFcmToken();
  const token = useAppSelector(selectToken);
  if (token) return <RootNavigator />;

  return <PublicStackNavigator />;
};

const App = () => {
  return (
    <SafeAreaProvider>
      <Provider store={store}>
        <GestureHandlerRootView>
          <KeyboardProvider>
            <NavigationContainer linking={linking}>
              <SystemBars style={'dark'} />
              <AppInner />
            </NavigationContainer>
          </KeyboardProvider>
        </GestureHandlerRootView>
      </Provider>
    </SafeAreaProvider>
  );
};

export default App;
