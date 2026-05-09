import { NavigatorScreenParams } from '@react-navigation/native';

type BottomTabNavigatorParamList = {
  Home: undefined;
  Menu: undefined;
  Story: undefined;
  Notifications: undefined;
};

type RootStackNavigatorParamList = {
  BottomTab: NavigatorScreenParams<BottomTabNavigatorParamList>;
  Inbox: {
    conversationId: string;
    displayName?: string;
    avatarUrl?: string | null;
    token?: string;
    liveKitRoom?: string;
  };
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
  AudioCall: {
    displayName?: string;
    liveKitRoom?: string;
  };
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
  VideoCall: {
    displayName?: string;
    liveKitRoom?: string;
  };
};

type MediaTabNavigatorParamList = {
  Media: undefined;
  Files: undefined;
  Links: undefined;
};

type PublicStackNavigatorParamList = {
  Login: undefined;
  ForgotPassword: undefined;
};

export type {
  BottomTabNavigatorParamList,
  RootStackNavigatorParamList,
  MediaTabNavigatorParamList,
  PublicStackNavigatorParamList,
};
