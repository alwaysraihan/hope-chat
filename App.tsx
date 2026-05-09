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

const AppInner = () => {
  const loggedIn = useAppSelector(selectHopeChatLoggedIn);
  if (!loggedIn) return <PublicStackNavigator />;

  return (
    <ChatsProvider>
      <RootNavigator />
    </ChatsProvider>
  );
};

const App = () => {
  return (
    <SafeAreaProvider>
      <Provider store={store}>
        <GestureHandlerRootView>
          <KeyboardProvider>
            <NavigationContainer>
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
