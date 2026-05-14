import React, { useEffect } from 'react';
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
import AuthBootstrap from './src/components/AuthBootstrap';
import IncomingCallListener from './src/components/IncomingCallListener';
import { navigationRef } from './src/navigation/navigationRef';
import { consumePendingIncomingCall } from './src/services/incomingCall/navigateIncomingCall';
import BootSplash from 'react-native-bootsplash';
import { readPersistedHopenityUser } from './src/services/hopenitySharedAuth';

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
    <SafeAreaProvider>
      <Provider store={store}>
        <AuthBootstrap />
        <GestureHandlerRootView>
          <KeyboardProvider>
            <NavigationWithAuthKey />
          </KeyboardProvider>
        </GestureHandlerRootView>
      </Provider>
    </SafeAreaProvider>
  );
};

export default App;
