import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import { RootNavigatorParamList } from '../types/navigators';
import InboxScreen from '../screens/InboxScreen';

const RootStack = createNativeStackNavigator<RootNavigatorParamList>();
const RootNavigator = () => {
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="Home" component={HomeScreen} />
      <RootStack.Screen name="Inbox" component={InboxScreen} />
    </RootStack.Navigator>
  );
};

export default RootNavigator;
