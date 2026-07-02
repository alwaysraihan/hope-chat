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
    /** Hopenity user ID — passed explicitly so openHopenityProfile works even when peerUserId is missing from the cached conversation. */
    peerUserId?: string;
  };
  Search: undefined;
  ConversationAction: {
    conversationId: string;
    conversationName: string;
    isGroup?: boolean;
    /** True when this conversation came from the v1 API (has conversationKey) — used to pick the block API version. */
    isV1Chat?: boolean;
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
    /** Optimistic members passed back from AddGroupMembersScreen. Consumed once on focus. */
    newMembers?: { userId: string; name?: string; image?: string | null }[];
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
    /** True for groups and v2-native DMs — block/unblock must hit the v2 endpoint. */
    useV2?: boolean;
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
    /** Group call — ring screen shows the group name with "{caller} started a call in {group}". */
    isGroupCall?: boolean;
    groupName?: string;
    groupPhotoUrl?: string | null;
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
