import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackNavigatorParamList } from '../types/navigators';
import InboxScreen from '../screens/InboxScreen';
import ProfileScreen from '../screens/ProfileScreen';
import BottomTabNavigator from './BottomTabNavigator';

const RootStack = createNativeStackNavigator<RootStackNavigatorParamList>();

const StackNavigator = () => {
  return (
    <RootStack.Navigator
      initialRouteName="BottomTab"
      screenOptions={{ headerShown: false }}
    >
      <RootStack.Screen name="BottomTab" component={BottomTabNavigator} />
      <RootStack.Screen name="Inbox" component={InboxScreen} />
      <RootStack.Screen name="Profile" component={ProfileScreen} />
    </RootStack.Navigator>
  );
};

export default StackNavigator;
