import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackNavigatorParamList } from '../types/navigators';
import InboxScreen from '../screens/InboxScreen';
import ProfileScreen from '../screens/ProfileScreen';
import BottomTabNavigator from './BottomTabNavigator';
import SearchScreen from '../screens/SearchScreen';
import ConversationActionScreen from '../screens/ConversationActionScreen';
import EditSearchHistoryScreen from '../screens/EditSearchHistoryScreen';
import ArchiveScreen from '../screens/ArchiveScreen';

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
      <RootStack.Screen name="Search" component={SearchScreen} />
      <RootStack.Screen name="Archive" component={ArchiveScreen} />
      <RootStack.Screen
        name="EditSearchHistory"
        component={EditSearchHistoryScreen}
      />
      <RootStack.Screen
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: 'fitToContents',
          contentStyle: { backgroundColor: 'transparent' },
        }}
        name="ConversationAction"
        component={ConversationActionScreen}
      />
    </RootStack.Navigator>
  );
};

export default StackNavigator;
