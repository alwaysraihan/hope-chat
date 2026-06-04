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
import GroupSetupScreen from '../screens/GroupSetupScreen';
import GroupInfoScreen from '../screens/GroupInfoScreen';
import AddGroupMembersScreen from '../screens/AddGroupMembersScreen';
import JoinGroupScreen from '../screens/JoinGroupScreen';
import PremiumCallSetupScreen from '../screens/PremiumCallSetupScreen';
import BookCallScreen from '../screens/BookCallScreen';
import HopeWishScreen from '../screens/HopeWishScreen';
import ReadReceiptsScreen from '../screens/ReadReceiptsScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScren';
import LoginScreen from '../screens/LoginScreen';
import BlockUserScreen from '../screens/BlockUserScreen';
import AudioCallScreen from '../screens/AudioCallScreen';
import TypingIndicatorScreen from '../screens/TypingIndicatorScreen';
import ThemeScreen from '../screens/ThemeScreen';
import DisappearingMessagesScreen from '../screens/DisappearingMessagesScreen';
import ReportProblemScreen from '../screens/ReportProblemScreen';
import MessagePermissionsScreen from '../screens/MessagePermissionsScreen';
import RestrictUserScreen from '../screens/RestrictUserScreen';
import MessageRequestsScreen from '../screens/MessegeRequestScreen';
import ReactionsScreen from '../screens/ReactionsScreen';
import VideoCallScreen from '../screens/VideoCallScreen';
import EmailLoginScreen from '../screens/EmailLoginScreen';
import DeviceApprovalWaitScreen from '../screens/DeviceApprovalWaitScreen';
import IncomingCallScreen from '../screens/IncomingCallScreen';
import StoryViewerScreen from '../screens/StoryViewerScreen';
import CreateStoryScreen from '../screens/CreateStoryScreen';
import SettingsScreen from '../screens/SettingsScreen';
import BlockedPeopleScreen from '../screens/BlockedPeopleScreen';

const RootStack = createNativeStackNavigator<RootStackNavigatorParamList>();

const StackNavigator = () => {
  return (
    <RootStack.Navigator
      initialRouteName="BottomTab"
      screenOptions={{ headerShown: false }}
    >
      <RootStack.Screen name="BottomTab" component={BottomTabNavigator} />
      <RootStack.Screen name="Login" component={LoginScreen} />
      <RootStack.Screen name="EmailLogin" component={EmailLoginScreen} />
      <RootStack.Screen
        name="DeviceApprovalWait"
        component={DeviceApprovalWaitScreen}
      />
      <RootStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
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
      <RootStack.Screen name="GroupSetup" component={GroupSetupScreen} />
      <RootStack.Screen name="GroupInfo" component={GroupInfoScreen} />
      <RootStack.Screen name="AddGroupMembers" component={AddGroupMembersScreen} />
      <RootStack.Screen name="JoinGroup" component={JoinGroupScreen} options={{ headerShown: false }} />
      <RootStack.Screen name="PremiumCallSetup" component={PremiumCallSetupScreen} options={{ headerShown: false }} />
      <RootStack.Screen name="BookCall" component={BookCallScreen} options={{ headerShown: false }} />
      <RootStack.Screen name="HopeWish" component={HopeWishScreen} options={{ headerShown: false }} />
      <RootStack.Screen name="ReadReceipts" component={ReadReceiptsScreen} />
      <RootStack.Screen
        name="TypingIndicator"
        component={TypingIndicatorScreen}
      />
      <RootStack.Screen
        name="AudioCall"
        component={AudioCallScreen}
        options={{ gestureEnabled: false }}
      />
      <RootStack.Screen
        name="VideoCall"
        component={VideoCallScreen}
        options={{ gestureEnabled: false }}
      />
      <RootStack.Screen
        name="IncomingCall"
        component={IncomingCallScreen}
        options={{
          presentation: 'fullScreenModal',
          animation: 'fade',
          gestureEnabled: false,
        }}
      />
      <RootStack.Screen
        name="StoryViewer"
        component={StoryViewerScreen}
        options={{
          presentation: 'fullScreenModal',
          animation: 'fade',
          gestureEnabled: true,
        }}
      />
      <RootStack.Screen name="CreateStory" component={CreateStoryScreen} />
      <RootStack.Screen name="Settings" component={SettingsScreen} />
      <RootStack.Screen name="BlockedPeople" component={BlockedPeopleScreen} />
      <RootStack.Screen
        name="DisappearingMessages"
        component={DisappearingMessagesScreen}
      />
      <RootStack.Screen name="ReportProblem" component={ReportProblemScreen} />
      <RootStack.Screen
        name="MessagePermissions"
        component={MessagePermissionsScreen}
      />
      <RootStack.Screen name="RestrictUser" component={RestrictUserScreen} />
      <RootStack.Screen
        name="MessageRequests"
        component={MessageRequestsScreen}
      />
      <RootStack.Screen
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: 'fitToContents',
          contentStyle: { backgroundColor: 'transparent' },
        }}
        name="Reactions"
        component={ReactionsScreen}
      />
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
