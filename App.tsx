import React, { useEffect } from 'react';
import { Linking } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import RootNavigator from './src/navigation/RootNavigator';
import { SystemBars } from 'react-native-edge-to-edge';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Provider } from 'react-redux';
import { store } from './src/redux/store';
import PublicStackNavigator from './src/navigation/PublicStackNavigator';
import { useAppDispatch, useAppSelector } from './src/hooks/redux';
import {
  selectHopeChatLoggedIn,
  setHopenitySession,
} from './src/redux/features/auth/authSlice';
import { ChatsProvider } from './src/context/ChatsContext';
import { LanguageProvider } from './src/context/LanguageContext';
import AuthBootstrap from './src/components/AuthBootstrap';
import IncomingCallListener from './src/components/IncomingCallListener';
import AppErrorBoundary from './src/components/AppErrorBoundary';
import { navigationRef } from './src/navigation/navigationRef';
import { consumePendingIncomingCall } from './src/services/incomingCall/navigateIncomingCall';
import BootSplash from 'react-native-bootsplash';
import { readPersistedHopenityUser } from './src/services/hopenitySharedAuth';
import { setPendingPeerLink } from './src/services/peerDeepLink';

const PEER_DEEP_LINK_RE = /^hopechat:\/\/peer\/([^/?#]+)/i;

function handleDeepLinkUrl(url: string | null | undefined): void {
  if (!url) return;
  const m = url.match(PEER_DEEP_LINK_RE);
  if (!m?.[1]) return;
  const peerId = decodeURIComponent(m[1]);
  setPendingPeerLink(peerId);
  // Bring HomeScreen into view so its listener can navigate to the right chat.
  if (navigationRef.isReady()) {
    navigationRef.navigate('BottomTab' as never, { screen: 'Home' } as never);
  }
}

const AppInner = () => {
  const loggedIn = useAppSelector(selectHopeChatLoggedIn);

  return (
    <React.Fragment key={loggedIn ? 'session' : 'guest'}>
      {!loggedIn ? (
        <PublicStackNavigator />
      ) : (
        <ChatsProvider>
          <IncomingCallListener />
          <RootNavigator />
        </ChatsProvider>
      )}
    </React.Fragment>
  );
};

/** Remount navigation when auth flips so stacks do not keep stale guest routes. */
const NavigationWithAuthKey = () => {
  const loggedIn = useAppSelector(selectHopeChatLoggedIn);
  const dispatch = useAppDispatch();

  useEffect(() => {
    const token = readPersistedHopenityUser();
    if (!token) return;
    dispatch(setHopenitySession({ blob: token }));
  }, [dispatch]);

  // Handle hopechat://peer/{userId} deep links — both cold-start and runtime.
  useEffect(() => {
    Linking.getInitialURL().then(handleDeepLinkUrl);
    const sub = Linking.addEventListener('url', ({ url }) => handleDeepLinkUrl(url));
    return () => sub.remove();
  }, []);

  return (
    <NavigationContainer
      key={loggedIn ? 'hopechat-session' : 'hopechat-guest'}
      ref={navigationRef}
      onReady={() => {
        consumePendingIncomingCall();
        BootSplash.hide({ fade: true });
      }}
    >
      <SystemBars style={'dark'} />
      <AppInner />
    </NavigationContainer>
  );
};

const App = () => {
  return (
    <AppErrorBoundary>
      <SafeAreaProvider>
        <Provider store={store}>
          <LanguageProvider>
            <AuthBootstrap />
            <GestureHandlerRootView style={{ flex: 1 }}>
              <KeyboardProvider>
                <NavigationWithAuthKey />
              </KeyboardProvider>
            </GestureHandlerRootView>
          </LanguageProvider>
        </Provider>
      </SafeAreaProvider>
    </AppErrorBoundary>
  );
};

export default App;
