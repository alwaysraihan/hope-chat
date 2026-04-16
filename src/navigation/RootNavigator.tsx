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
import AutoSavePhotosScreen from '../screens/AutoSavePhotosScreen';
import NotificationsSoundsScreen from '../screens/NotificationsSoundsScreen';
import PinnedMessagesScreen from '../screens/PinnedMessagesScreen';
import WordEffectsScreen from '../screens/WordEffectsScreen';
import NicknamesScreen from '../screens/NicknamesScreen';
import MediaTabNavigator from './MediaTabNavigator';
import { NewGroupScreen } from '../screens/NewGroupScreen';
import ReadReceiptsScreen from '../screens/ReadReceiptsScreen';
import BlockUserScreen from '../screens/BlockUserScreen';
import AudioCallScreen from '../screens/AudioCallScreen';
import TypingIndicatorScreen from '../screens/TypingIndicatorScreen';
import ThemeScreen from '../screens/ThemeScreen';

const RootStack = createNativeStackNavigator<RootStackNavigatorParamList>();

const StackNavigator = () => {
  return (
    <RootStack.Navigator
      initialRouteName="BottomTab"
      screenOptions={{ headerShown: false }}
    >
      <RootStack.Screen name="BottomTab" component={BottomTabNavigator} />
      <RootStack.Screen name="MediaTab" component={MediaTabNavigator} />
      <RootStack.Screen name="Inbox" component={InboxScreen} />
      <RootStack.Screen name="Profile" component={ProfileScreen} />
      <RootStack.Screen name="Search" component={SearchScreen} />
      <RootStack.Screen name="Archive" component={ArchiveScreen} />
      <RootStack.Screen
        name="EditSearchHistory"
        component={EditSearchHistoryScreen}
      />
      <RootStack.Screen
        name="AutoSavePhotos"
        component={AutoSavePhotosScreen}
      />
      <RootStack.Screen
        name="NotificationsSounds"
        component={NotificationsSoundsScreen}
      />
      <RootStack.Screen
        name="PinnedMessages"
        component={PinnedMessagesScreen}
      />
      <RootStack.Screen name="WordEffects" component={WordEffectsScreen} />
      <RootStack.Screen name="Nicknames" component={NicknamesScreen} />
      <RootStack.Screen name="NewGroup" component={NewGroupScreen} />
      <RootStack.Screen name="ReadReceipts" component={ReadReceiptsScreen} />
      <RootStack.Screen
        name="TypingIndicator"
        component={TypingIndicatorScreen}
      />
      <RootStack.Screen name="AudioCall" component={AudioCallScreen} />
      <RootStack.Screen
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: 'fitToContents',
          contentStyle: { backgroundColor: 'transparent' },
        }}
        name="BlockedUser"
        component={BlockUserScreen}
      />
      <RootStack.Screen
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: 'fitToContents',
          contentStyle: { backgroundColor: 'transparent' },
        }}
        name="Theme"
        component={ThemeScreen}
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
