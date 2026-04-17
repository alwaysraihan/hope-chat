import React from 'react';
import HomeScreen from '../screens/HomeScreen';
import MenuScreen from '../screens/MenuScreen';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import CustomTabBar from '../components/CustomTabBar';
import { BottomTabNavigatorParamList } from '../types/navigators';
import StoryScreen from '../screens/StoryScreen';
import DiscoverScreen from '../screens/DiscoverScreen';
import NotificationsScreen from '../screens/NotificationsScreen';

const TabNavigator = createBottomTabNavigator<BottomTabNavigatorParamList>();
const BottomTabNavigator = () => {
  return (
    <TabNavigator.Navigator
      tabBar={props => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <TabNavigator.Screen name="Home" component={HomeScreen} />
      <TabNavigator.Screen name="Story" component={StoryScreen} />
      <TabNavigator.Screen name="Discover" component={NotificationsScreen} />
      <TabNavigator.Screen name="Menu" component={MenuScreen} />
    </TabNavigator.Navigator>
  );
};

export default BottomTabNavigator;
