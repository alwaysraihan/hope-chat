import React from 'react';
import HomeScreen from '../screens/HomeScreen';
import MenuScreen from '../screens/MenuScreen';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import CustomTabBar from '../components/CustomTabBar';
import { BottomTabNavigatorParamList } from '../types/navigators';
import NotificationsScreen from '../screens/NotificationsScreen';
import StatusScreen from '../screens/StatusScreen';

const TabNavigator = createBottomTabNavigator<BottomTabNavigatorParamList>();
const BottomTabNavigator = () => {
  return (
    <TabNavigator.Navigator
      tabBar={props => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <TabNavigator.Screen name="Home" component={HomeScreen} />
      <TabNavigator.Screen name="Story" component={StatusScreen} />
      <TabNavigator.Screen
        name="Notifications"
        component={NotificationsScreen}
      />
      <TabNavigator.Screen name="Menu" component={MenuScreen} />
    </TabNavigator.Navigator>
  );
};

export default BottomTabNavigator;
