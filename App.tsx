import React from 'react';
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
import AuthBootstrap from './src/components/AuthBootstrap';
import IncomingCallListener from './src/components/IncomingCallListener';
import { navigationRef } from './src/navigation/navigationRef';
import { consumePendingIncomingCall } from './src/services/incomingCall/navigateIncomingCall';
import BootSplash from 'react-native-bootsplash';

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

const App = () => {
  return (
    <SafeAreaProvider>
      <Provider store={store}>
        <AuthBootstrap />
        <GestureHandlerRootView>
          <KeyboardProvider>
            <NavigationContainer
              ref={navigationRef}
              onReady={() => {
                consumePendingIncomingCall();
                BootSplash.hide({ fade: true });
              }}
            >
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
