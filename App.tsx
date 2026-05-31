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
import {
  isAuthDeepLink,
  parseAuthDeepLink,
  setPendingAuthLink,
} from './src/services/authDeepLink';

// hopechat://peer/{userId}?name=John%20Doe&avatar=https%3A%2F%2F...
const PEER_DEEP_LINK_RE = /^hopechat:\/\/peer\/([^/?#]+)(?:\?(.*))?/i;
// hopechat://peer/{userId} embedded inside a redirect param
const PEER_PATH_RE = /^peer\/([^/?#]+)(?:\?(.*))?/i;

function parseQs(qs: string | undefined, key: string): string | undefined {
  if (!qs) return undefined;
  const re = new RegExp(`(?:^|&)${key}=([^&]*)`);
  const m = qs.match(re);
  return m?.[1] ? decodeURIComponent(m[1]) : undefined;
}

function handleDeepLinkUrl(url: string | null | undefined): void {
  if (!url) return;

  // ── Auth handoff from Hopenity (hopechat://auth?token=...&user=...&redirect=...) ──
  //
  // Hopenity injects the session token when opening HopeChat so the user is
  // logged in automatically — no "Continue as" card, no extra tap.
  //
  // If the user is ALREADY logged in we skip the auth part and just process the
  // redirect (if any) as a normal peer deep link so they land on the right chat.
  if (isAuthDeepLink(url)) {
    const authPayload = parseAuthDeepLink(url);
    if (!authPayload) return;

    const loggedIn = !!(store.getState() as { auth: { token: string | null } }).auth.token;

    if (!loggedIn) {
      // LoginScreen will pick this up on focus / via the live listener.
      setPendingAuthLink(authPayload);
    }

    // Always process the redirect so the user lands on the right chat.
    const { redirect } = authPayload;
    if (redirect) {
      const pm = redirect.match(PEER_PATH_RE);
      if (pm?.[1]) {
        const peerId = decodeURIComponent(pm[1]);
        const qs = pm[2];
        setPendingPeerLink({
          peerId,
          displayName: parseQs(qs, 'name'),
          avatarUrl: parseQs(qs, 'avatar') ?? null,
          chatId: parseQs(qs, 'chatId') ?? null,
        });
        // Only navigate to Home now if already logged in; LoginScreen will do
        // it after the token is validated for unauthenticated users.
        if (loggedIn) {
          // The NavigationContainer may have just remounted (key changed after
          // login) so isReady() can be false for a brief window.  Retry after
          // one frame to ensure the navigator is fully initialised.
          if (navigationRef.isReady()) {
            navigationRef.navigate('BottomTab' as never, { screen: 'Home' } as never);
          } else {
            setTimeout(() => {
              if (navigationRef.isReady()) {
                navigationRef.navigate('BottomTab' as never, { screen: 'Home' } as never);
              }
            }, 250);
          }
        }
      }
    }
    return;
  }

  // ── Peer deep link (hopechat://peer/{userId}?...) ───────────────────────────
  const m = url.match(PEER_DEEP_LINK_RE);
  if (!m?.[1]) return;
  const peerId = decodeURIComponent(m[1]);
  const qs = m[2];
  setPendingPeerLink({
    peerId,
    displayName: parseQs(qs, 'name'),
    avatarUrl: parseQs(qs, 'avatar') ?? null,
    // Hopenity may pass the real conversationId so HopeChat can navigate
    // directly without a redundant getOrCreatePeerChat API call.
    chatId: parseQs(qs, 'chatId') ?? null,
  });
  // Bring HomeScreen into view so its listener can navigate to the right chat.
  if (navigationRef.isReady()) {
    navigationRef.navigate('BottomTab' as never, { screen: 'Home' } as never);
  }
}

const AppInner = () => {
  const loggedIn = useAppSelector(selectHopeChatLoggedIn);

  // No Fragment key needed here — NavigationContainer above already carries the
  // auth key, so the entire subtree (including AppInner) is remounted when loggedIn
  // flips. Adding a second key here caused a double reconciliation pass that crashed
  // React Navigation mid-teardown on logout.
  return loggedIn ? (
    <ChatsProvider>
      <IncomingCallListener />
      <RootNavigator />
    </ChatsProvider>
  ) : (
    <PublicStackNavigator />
  );
};

/** Remount navigation when auth flips so stacks do not keep stale guest routes. */
const NavigationWithAuthKey = () => {
  const loggedIn = useAppSelector(selectHopeChatLoggedIn);

  // Handle deep links — cold-start and runtime.
  //
  // IMPORTANT: `Linking.getInitialURL()` returns the same launch URL on every
  // call, including after the NavigationContainer remounts due to an auth-key
  // change.  Without a guard the same auth URL would be processed twice:
  //  • once before login (→ setPendingAuthLink)
  //  • once after login (→ navigate to Home)
  // Both passes are correct by themselves, but we track the last-handled URL
  // to avoid spurious duplicate peer-link stores and navigation calls.
  useEffect(() => {
    let lastHandledUrl: string | null = null;

    const handle = (url: string | null | undefined) => {
      if (!url || url === lastHandledUrl) return;
      lastHandledUrl = url;
      handleDeepLinkUrl(url);
    };

    Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener('url', ({ url }) => {
      // Runtime links are always new; reset the guard so they are always handled.
      lastHandledUrl = null;
      handle(url);
    });
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
