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
import { useAppSelector } from './src/hooks/redux';
import { selectHopeChatLoggedIn } from './src/redux/features/auth/authSlice';
import { ChatsProvider } from './src/context/ChatsContext';
import { LanguageProvider } from './src/context/LanguageContext';
import AuthBootstrap from './src/components/AuthBootstrap';
import IncomingCallListener from './src/components/IncomingCallListener';
import AppErrorBoundary from './src/components/AppErrorBoundary';
import { navigationRef } from './src/navigation/navigationRef';
import { consumePendingIncomingCall } from './src/services/incomingCall/navigateIncomingCall';
import BootSplash from 'react-native-bootsplash';
import { setPendingPeerLink } from './src/services/peerDeepLink';

// hopechat://peer/{userId}?name=John%20Doe&avatar=https%3A%2F%2F...
const PEER_DEEP_LINK_RE = /^hopechat:\/\/peer\/([^/?#]+)(?:\?(.*))?/i;

function parseQs(qs: string | undefined, key: string): string | undefined {
  if (!qs) return undefined;
  const re = new RegExp(`(?:^|&)${key}=([^&]*)`);
  const m = qs.match(re);
  return m?.[1] ? decodeURIComponent(m[1]) : undefined;
}

function handleDeepLinkUrl(url: string | null | undefined): void {
  if (!url) return;
  const m = url.match(PEER_DEEP_LINK_RE);
  if (!m?.[1]) return;
  const peerId = decodeURIComponent(m[1]);
  const qs = m[2];
  setPendingPeerLink({
    peerId,
    displayName: parseQs(qs, 'name'),
    avatarUrl: parseQs(qs, 'avatar') ?? null,
  });
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
