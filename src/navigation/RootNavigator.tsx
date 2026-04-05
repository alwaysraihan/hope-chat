import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import { RootNavigatorParamList } from '../types/navigators';

const RootStack = createNativeStackNavigator<RootNavigatorParamList>();
const RootNavigator = () => {
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="Home" component={HomeScreen} />
    </RootStack.Navigator>
  );
};

export default RootNavigator;
