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
    /** conversation ID (same as ConversationSummary.id) */
    userId: string;
  };
  Search: undefined;
  ConversationAction: {
    conversationId: string;
    conversationName: string;
    isGroup?: boolean;
    isMuted?: boolean;
    isPinned?: boolean;
    peerUserId?: string;
  };
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
    /** True when calling a group conversation — all members are notified. */
    isGroupCall?: boolean;
  };
  NewGroup: undefined;
  GroupSetup: {
    /** User IDs selected in NewGroupScreen */
    selectedUserIds: string[];
    /** Display names matching selectedUserIds (for chips preview) */
    selectedNames: string[];
  };
  GroupInfo: {
    groupId: string;
    conversationId: string;
  };
  AddGroupMembers: {
    groupId: string;
    /** Current member IDs — used to filter them out of the picker */
    existingMemberIds: string[];
  };
  TypingIndicator: undefined;
  BlockedUser: {
    chatId: string;
    peerName: string;
    isBlocked: boolean;
  };
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
    /** True when calling a group conversation — all members are notified. */
    isGroupCall?: boolean;
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
  /** In-app story creation screen. */
  CreateStory: undefined;
  /** List of blocked people and pages with unblock action. */
  BlockedPeople: undefined;
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
