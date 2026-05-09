import { NavigatorScreenParams } from '@react-navigation/native';

type BottomTabNavigatorParamList = {
  Home: undefined;
  Menu: undefined;
  Story: undefined;
  Notifications: undefined;
};

type RootStackNavigatorParamList = {
  BottomTab: NavigatorScreenParams<BottomTabNavigatorParamList>;
  Inbox: undefined;
  Profile: {
    userId: string;
  };
  Search: undefined;
  ConversationAction: undefined;
  EditSearchHistory: undefined;
  Archive: undefined;
  NotificationsSounds: undefined;
  PinnedMessages: undefined;
  WordEffects: undefined;
  AutoSavePhotos: undefined;
  Nicknames: undefined;
  MediaTab: NavigatorScreenParams<MediaTabNavigatorParamList>;
  AudioCall: undefined;
  NewGroup: undefined;
  TypingIndicator: undefined;
  BlockedUser: undefined;
  ReadReceipts: undefined;
  Theme: undefined;
  RestrictUser: undefined;
  ReportProblem: undefined;
  MessagePermissions: undefined;
  DisappearingMessages: undefined;
  Settings: undefined;
  MessageRequests: undefined;
  Reactions: undefined;
  VideoCall: undefined;
};

type MediaTabNavigatorParamList = {
  Media: undefined;
  Files: undefined;
  Links: undefined;
};

type PublicStackNavigatorParamList = {
  Login: undefined;
};

export type {
  BottomTabNavigatorParamList,
  RootStackNavigatorParamList,
  MediaTabNavigatorParamList,
  PublicStackNavigatorParamList,
};
