import { NavigatorScreenParams } from '@react-navigation/native';

import type { ConversationSummary } from '../context/ChatsContext';

type BottomTabNavigatorParamList = {
  Home: undefined;
  Menu: undefined;
  Story: undefined;
  Notifications: undefined;
};

type AuthNavigatorParamList = {
  Login: undefined;
  EmailLogin: undefined;
  ForgotPassword: undefined;
  DeviceApprovalWait: {
    requestToken: string;
    deviceName?: string;
    expiresAt?: string;
    message?: string;
    approvalStatus?: string;
    retryPayload?: {
      email?: string;
      phoneNumber?: string;
      password: string;
    };
  };
};

type RootStackNavigatorParamList = AuthNavigatorParamList & {
  BottomTab: NavigatorScreenParams<BottomTabNavigatorParamList>;
  Inbox: {
    conversationId: string;
    displayName?: string;
    avatarUrl?: string | null;
    token?: string;
    liveKitRoom?: string;
    /** When opened from Requests (chat not yet in ACTIVE inbox cache). */
    seedConversation?: ConversationSummary;
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
    avatarUrl?: string | null;
    conversationId?: string;
    peerUserId?: string;
    callDirection?: 'outgoing' | 'incoming';
  };
  NewGroup: undefined;
  TypingIndicator: undefined;
  BlockedUser: undefined;
  ReadReceipts: undefined;
  Theme: undefined;
  RestrictUser: undefined;
  ReportProblem: undefined;
  MessagePermissions: undefined;
  DisappearingMessages: { conversationId?: string } | undefined;
  Settings: undefined;
  MessageRequests: undefined;
  Reactions: undefined;
  VideoCall: {
    displayName?: string;
    liveKitRoom?: string;
    avatarUrl?: string | null;
    conversationId?: string;
    peerUserId?: string;
    callDirection?: 'outgoing' | 'incoming';
  };
  IncomingCall: {
    callKind: 'audio' | 'video';
    liveKitRoom: string;
    displayName: string;
    callerId?: string;
    avatarUrl?: string | null;
    /** When push includes it — used for missed-call rows in chat. */
    conversationId?: string;
    /** Skip ringing UI and accept immediately (used when Accept button pressed in notification). */
    autoAccept?: boolean;
  };
  /** Full-screen Story viewer (ring index into `setStoryFeedRings` cache). */
  StoryViewer: { ringIndex: number };
};

type MediaTabNavigatorParamList = {
  Media: undefined;
  Files: undefined;
  Links: undefined;
};

type PublicStackNavigatorParamList = AuthNavigatorParamList;

export type {
  BottomTabNavigatorParamList,
  RootStackNavigatorParamList,
  MediaTabNavigatorParamList,
  PublicStackNavigatorParamList,
};
