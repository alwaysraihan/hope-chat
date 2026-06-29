import React, { useEffect, useRef } from 'react';
import { Linking } from 'react-native';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
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
import { ThemeProvider, useAppTheme } from './src/context/ThemeContext';
import { LanguageProvider } from './src/context/LanguageContext';
import AuthBootstrap from './src/components/AuthBootstrap';
import IncomingCallListener from './src/components/IncomingCallListener';
import AppErrorBoundary from './src/components/AppErrorBoundary';
import { ToastContainer } from './src/components/Toast';
import { refreshExchangeRates } from './src/utils/currency';
import { navigationRef } from './src/navigation/navigationRef';
import { consumePendingIncomingCall } from './src/services/incomingCall/navigateIncomingCall';

// ─── Pending screen-navigation store ─────────────────────────────────────────
// Deep links that arrive during cold-start store their params here so they can
// be flushed from NavigationContainer.onReady once the stack is mounted.
type PendingScreenNav =
  | { screen: 'BookCall';  params: { targetUserId: string; targetName: string; targetAvatar: string | null; isHopeWish: boolean } }
  | { screen: 'HopeWish';  params: { targetUserId: string; targetName: string; targetAvatar: string | null } }
  | { screen: 'PremiumCallSetup'; params: undefined };

let _pendingScreenNav: PendingScreenNav | null = null;

function setPendingScreenNav(nav: PendingScreenNav): void {
  _pendingScreenNav = nav;
}

function flushPendingScreenNav(): void {
  if (!_pendingScreenNav) return;
  const nav = _pendingScreenNav;
  _pendingScreenNav = null;
  if (!navigationRef.isReady()) return;
  (navigationRef as any).navigate(nav.screen, nav.params);
}
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
const PEER_PATH_RE        = /^peer\/([^/?#]+)(?:\?(.*))?/i;
// Same paths as top-level regexes but without the scheme prefix — used when
// the path arrives as the `redirect` value inside a hopechat://auth link.
const BOOK_CALL_PATH_RE   = /^book-call\/([^/?#]+)(?:\?(.*))?/i;
const HOPE_WISH_PATH_RE   = /^hope-wish\/([^/?#]+)(?:\?(.*))?/i;
const PREMIUM_SETUP_PATH_RE = /^premium-calls\/setup/i;
// hopechat://join-group/{inviteCode}
const JOIN_GROUP_RE = /^hopechat:\/\/join-group\/([^/?#]+)/i;
// hopechat://book-call/{userId}?name=...&avatar=...
const BOOK_CALL_RE = /^hopechat:\/\/book-call\/([^/?#]+)(?:\?(.*))?/i;
// hopechat://hope-wish/{userId}?name=...&avatar=...
const HOPE_WISH_RE = /^hopechat:\/\/hope-wish\/([^/?#]+)(?:\?(.*))?/i;
// hopechat://premium-calls/setup
const PREMIUM_CALLS_SETUP_RE = /^hopechat:\/\/premium-calls\/setup/i;
// hopechat.chat/group/join/{code}  (primary shareable URL)
const HOPECHAT_GROUP_JOIN_RE = /hopechat\.chat\/group\/join\/([^/?#]+)/i;
// hopenity.com/group/join/{code}  (legacy — keep handling old shared links)
const HOPENITY_GROUP_JOIN_RE = /hopenity\.com\/group\/join\/([^/?#]+)/i;

function parseQs(qs: string | undefined, key: string): string | undefined {
  if (!qs) return undefined;
  const re = new RegExp(`(?:^|&)${key}=([^&]*)`);
  const m = qs.match(re);
  if (!m?.[1]) return undefined;
  try {
    // URLSearchParams encodes spaces as '+'; decodeURIComponent alone won't decode them.
    return decodeURIComponent(m[1].replace(/\+/g, '%20'));
  } catch {
    return m[1].replace(/\+/g, ' ');
  }
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

    // Always process the redirect so the user lands on the right screen.
    const { redirect } = authPayload;
    if (redirect) {
      // ── peer/ redirect → open the matching inbox ──────────────────────────
      const pm = redirect.match(PEER_PATH_RE);
      if (pm?.[1]) {
        const peerId = decodeURIComponent(pm[1]);
        const qs = pm[2];
        setPendingPeerLink({
          peerId,
          displayName: parseQs(qs, 'name'),
          avatarUrl: parseQs(qs, 'avatar') ?? null,
          chatId: parseQs(qs, 'chatId') ?? null,
          senderPageId: parseQs(qs, 'senderPageId') ?? null,
          senderPageName: parseQs(qs, 'senderPageName') ?? null,
          senderPageImage: parseQs(qs, 'senderPageImage') ?? null,
        });
        if (loggedIn) {
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
        return;
      }

      // ── book-call/{userId} redirect → open BookCall screen ───────────────
      const bcPath = redirect.match(BOOK_CALL_PATH_RE);
      if (bcPath?.[1]) {
        const userId = decodeURIComponent(bcPath[1]);
        const qs = bcPath[2];
        const params = {
          targetUserId: userId,
          targetName: parseQs(qs, 'name') ?? '',
          targetAvatar: parseQs(qs, 'avatar') ?? null,
          isHopeWish: false as const,
        };
        if (loggedIn && navigationRef.isReady()) {
          (navigationRef as any).navigate('BookCall', params);
        } else {
          // Store pending — flushed by NavigationContainer.onReady (cold start)
          // or after the auth token is processed (not logged in yet).
          setPendingScreenNav({ screen: 'BookCall', params });
        }
        return;
      }

      // ── hope-wish/{userId} redirect → open HopeWish screen ───────────────
      const hwPath = redirect.match(HOPE_WISH_PATH_RE);
      if (hwPath?.[1]) {
        const userId = decodeURIComponent(hwPath[1]);
        const qs = hwPath[2];
        const params = {
          targetUserId: userId,
          targetName: parseQs(qs, 'name') ?? '',
          targetAvatar: parseQs(qs, 'avatar') ?? null,
        };
        if (loggedIn && navigationRef.isReady()) {
          (navigationRef as any).navigate('HopeWish', params);
        } else {
          setPendingScreenNav({ screen: 'HopeWish', params });
        }
        return;
      }

      // ── premium-calls/setup redirect ──────────────────────────────────────
      if (PREMIUM_SETUP_PATH_RE.test(redirect)) {
        if (loggedIn && navigationRef.isReady()) {
          (navigationRef as any).navigate('PremiumCallSetup');
        } else {
          setPendingScreenNav({ screen: 'PremiumCallSetup', params: undefined });
        }
        return;
      }
    }
    return;
  }

  // ── Premium Calls setup deep link ─────────────────────────────────────────
  if (PREMIUM_CALLS_SETUP_RE.test(url)) {
    if (navigationRef.isReady()) {
      (navigationRef as any).navigate('PremiumCallSetup');
    } else {
      setPendingScreenNav({ screen: 'PremiumCallSetup', params: undefined });
    }
    return;
  }

  // ── Book call / Hope Wish deep links ───────────────────────────────────────
  // Both use a persistent pending-nav store instead of setTimeout so they work
  // on cold starts regardless of how long the JS bundle takes to hydrate.
  const hwm = url.match(HOPE_WISH_RE);
  if (hwm?.[1]) {
    const userId = decodeURIComponent(hwm[1]);
    const qs = hwm[2];
    const params = {
      targetUserId: userId,
      targetName: parseQs(qs, 'name') ?? '',
      targetAvatar: parseQs(qs, 'avatar') ?? null,
    };
    if (navigationRef.isReady()) {
      (navigationRef as any).navigate('HopeWish', params);
    } else {
      setPendingScreenNav({ screen: 'HopeWish', params });
    }
    return;
  }
  const bcm = url.match(BOOK_CALL_RE);
  if (bcm?.[1]) {
    const userId = decodeURIComponent(bcm[1]);
    const qs = bcm[2];
    const params = {
      targetUserId: userId,
      targetName: parseQs(qs, 'name') ?? '',
      targetAvatar: parseQs(qs, 'avatar') ?? null,
      isHopeWish: false,
    };
    if (navigationRef.isReady()) {
      (navigationRef as any).navigate('BookCall', params);
    } else {
      setPendingScreenNav({ screen: 'BookCall', params });
    }
    return;
  }

  // ── Group invite links ────────────────────────────────────────────────────
  // Handles all three forms:
  //   hopechat.chat/group/join/{code}    ← primary (new shareable URL)
  //   hopenity.com/group/join/{code}     ← legacy (keep old shared links working)
  //   hopechat://join-group/{code}       ← in-app deep link (handled below)
  const groupJoinMatch =
    url.match(HOPECHAT_GROUP_JOIN_RE) ?? url.match(HOPENITY_GROUP_JOIN_RE);
  if (groupJoinMatch?.[1]) {
    const code = decodeURIComponent(groupJoinMatch[1]);
    const navigate = () => { if (navigationRef.isReady()) (navigationRef as any).navigate('JoinGroup', { inviteCode: code }); };
    navigationRef.isReady() ? navigate() : setTimeout(navigate, 500);
    return;
  }

  const gm = url.match(JOIN_GROUP_RE);
  if (gm?.[1]) {
    const inviteCode = decodeURIComponent(gm[1]);
    const navigate = () => {
      if (navigationRef.isReady()) {
        (navigationRef as any).navigate('JoinGroup', { inviteCode });
      }
    };
    if (navigationRef.isReady()) {
      navigate();
    } else {
      setTimeout(navigate, 500);
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
    chatId: parseQs(qs, 'chatId') ?? null,
    autoCall: parseQs(qs, 'autoCall') === '1',
    senderPageId: parseQs(qs, 'senderPageId') ?? null,
    senderPageName: parseQs(qs, 'senderPageName') ?? null,
    senderPageImage: parseQs(qs, 'senderPageImage') ?? null,
  });
  // Bring HomeScreen into view so its listener can navigate to the right chat.
  if (navigationRef.isReady()) {
    navigationRef.navigate('BottomTab' as never, { screen: 'Home' } as never);
  }
}

const AppInner = () => {
  // Read loggedIn ONCE at mount and never re-subscribe.
  //
  // Why: NavigationContainer changes its `key` when loggedIn flips, which
  // unmounts and remounts the ENTIRE navigator tree — including AppInner.
  // The new AppInner mount reads the current store value, so it always
  // starts with the correct state.
  //
  // If AppInner subscribed via useAppSelector it would try to swap its children
  // (RootNavigator → PublicStackNavigator) at the same moment the NavigationContainer
  // teardown was running. React Navigation can't handle two concurrent navigator
  // destructions and crashes with an "Couldn't find a navigation object" error.
  const loggedIn = useRef(selectHopeChatLoggedIn(store.getState() as { auth: { token: string | null } })).current;

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
  const { isDark, colors } = useAppTheme();
  const navTheme = isDark
    ? { ...DarkTheme, colors: { ...DarkTheme.colors, background: colors.background, card: colors.surface, text: colors.textPrimary, border: colors.border } }
    : { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.background, card: colors.surface, text: colors.textPrimary, border: colors.border } };

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

    // Refresh exchange rates in the background so price conversions stay current.
    void refreshExchangeRates();
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
      theme={navTheme}
      onReady={() => {
        consumePendingIncomingCall();
        // Flush any screen nav that arrived while the bundle was still loading
        // (cold-start Book Call / Hope Wish / PremiumCallSetup deep links).
        flushPendingScreenNav();
        BootSplash.hide({ fade: true });
      }}
    >
      <SystemBars style={isDark ? 'light' : 'dark'} />
      <AppInner />
      <ToastContainer />
    </NavigationContainer>
  );
};

const App = () => {
  return (
    <AppErrorBoundary>
      <SafeAreaProvider>
        <Provider store={store}>
          <LanguageProvider>
            <ThemeProvider>
            <AuthBootstrap />
            <GestureHandlerRootView style={{ flex: 1 }}>
              <KeyboardProvider>
                <NavigationWithAuthKey />
              </KeyboardProvider>
            </GestureHandlerRootView>
          </ThemeProvider>
          </LanguageProvider>
        </Provider>
      </SafeAreaProvider>
    </AppErrorBoundary>
  );
};

export default App;
