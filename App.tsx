import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import RootNavigator from './src/navigation/RootNavigator';
import { SystemBars } from 'react-native-edge-to-edge';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';

const App = () => {
  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        <NavigationContainer>
          <SystemBars style={'dark'} />
          <RootNavigator />
        </NavigationContainer>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
};

export default App;
