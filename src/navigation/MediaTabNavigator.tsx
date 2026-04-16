import { StyleSheet } from 'react-native';
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MediaTabNavigatorParamList } from '../types/navigators';
import MediaFilesLinksScreen from '../screens/MediaFilesLinksScreen';
import CustomTabBar from '../components/CustomTabBar';
import FilesScreen from '../screens/FilesScreen';
import LinksScreen from '../screens/LinksScreen';

const Tab = createBottomTabNavigator<MediaTabNavigatorParamList>();

const MediaTabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
      }}
      tabBar={props => <CustomTabBar {...props} />}
    >
      <Tab.Screen name="Media" component={MediaFilesLinksScreen} />
      <Tab.Screen name="Files" component={FilesScreen} />
      <Tab.Screen name="Links" component={LinksScreen} />
    </Tab.Navigator>
  );
};

export default MediaTabNavigator;

const styles = StyleSheet.create({});
