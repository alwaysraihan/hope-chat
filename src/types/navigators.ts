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
    /** Present when the chat was opened from a booking — enables booking controls. */
    bookingId?: number;
    /** Current messagingEnabled state for the linked booking. */
    messagingEnabled?: boolean;
    /** True when the booking was made with callType='group' — changes call notification dispatch. */
    isGroupBooking?: boolean;
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
    isArchived?: boolean;
    /** When this chat was created from a booking, used for messaging toggle. */
    bookingId?: number;
    messagingEnabled?: boolean;
    /** True when the current user is the callee — only they can toggle messaging. */
    isBookingCallee?: boolean;
  };
  EditSearchHistory: undefined;
  Archive: undefined;
  NotificationsSounds: { conversationId?: string } | undefined;
  PinnedMessages: undefined;
  WordEffects: undefined;
  AutoSavePhotos: undefined;
  Nicknames: { conversationId: string } | undefined;
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
    conversationId: string;
    /** Current member IDs — used to filter them out of the picker */
    existingMemberIds: string[];
  };
  JoinGroup: { inviteCode: string };
  PremiumCallSetup: undefined;
  MyBookings: undefined;
  BookCall: {
    targetUserId: string;
    targetName: string;
    targetAvatar?: string | null;
    isHopeWish?: boolean;
  };
  HopeWish: {
    targetUserId: string;
    targetName: string;
    targetAvatar?: string | null;
  };
  TypingIndicator: undefined;
  BlockedUser: {
    chatId: string;
    peerName: string;
    isBlocked: boolean;
  };
  ReadReceipts: undefined;
  Theme: { conversationId?: string } | undefined;
  RestrictUser: { conversationId: string; peerName: string; peerUserId?: string };
  ReportProblem: undefined;
  MessagePermissions: undefined;
  DisappearingMessages: { conversationId?: string } | undefined;
  Settings: undefined;
  MessageRequests: undefined;
  Reactions: { conversationId?: string } | undefined;
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
