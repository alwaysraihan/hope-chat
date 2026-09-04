import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ImageBackground,
} from 'react-native';
import {
  Day,
  GiftedChat,
  IMessage,
  Message,
  MessageProps,
  Time,
  TimeProps,
} from 'react-native-gifted-chat';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Phone as PhoneIcon, Video as VideoIcon } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';

import { InboxProvider, useInbox } from '../context/InboxContext';
import WordEffectOverlay from '../components/WordEffectOverlay';
import { clearChatNotification } from '../services/notifications/messageNotification';
import { clearCallCancelled } from '../services/incomingCall/navigateIncomingCall';
import ChatMessageBox from '../components/message/ChatMessageBox';
import ForwardModal from '../components/message/ForwardModal';
import MessageHeader from '../components/message/MessageHeader';
import CustomInputToolbar from '../components/message/CustomInputToolbar';
import { useColors } from '../hooks/useColors';
import { RootStackNavigatorParamList } from '../types/navigators';
import type { ConversationSummary } from '../context/ChatsContext';
import { useChats } from '../context/ChatsContext';
import type { ExtendedMessage } from '../components/types/chat';
import { acceptHopenityChatRequest, fetchHopenityChatDirectory } from '../services/chatService';
import { fetchMyBookings } from '../services/premiumCallService';
import { getBookingForChat } from '../services/bookingChatMap';
import {
  selectAuthToken,
  selectHopenityProfile,
} from '../redux/features/auth/authSlice';
import { ensureCallPermissions } from '../utils/permissions';
import { useAppSelector } from '../hooks/redux';
import { normalizeChatUserId } from '../utils/chatUserId';
import { resolveLiveKitRoomName } from '../utils/livekitRoomId';
import { notifyPeerIncomingHopeChatCall } from '../services/invitePeerToHopeChatCall';
import {
  fetchGroupCallState,
  notifyGroupCall,
  type GroupCallState,
} from '../services/groupService';
import { callSocket } from '../services/callSocket';
import { getEffectiveAppearance, getConvAppearance } from '../services/chatPrefs';
import { Toast } from '../components/Toast';
import { THEME_1, THEME_2, THEME_3, THEME_4, THEME_5 } from '../assets';
import { formatLastSeenLine } from '../utils/formatLastSeen';
import { selectActivePage } from '../redux/features/auth/authSlice';
import { openHopenityProfile } from '../services/hopenityLinking';
import { ShopSheet } from '../components/message/ShopSheet';
import SharePreviewBar, { type PendingShare } from '../components/message/SharePreviewBar';

const PRESET_IMAGES: Record<number, number> = {
  1: THEME_1, 2: THEME_2, 3: THEME_3, 4: THEME_4, 5: THEME_5,
};

type Props = NativeStackScreenProps<RootStackNavigatorParamList, 'Inbox'>;

const InboxScreenInner: React.FC<
  Props & { conversation: ConversationSummary }
> = ({ navigation, route, conversation }) => {
  const colorss = useColors();
  const acceptStyles = useMemo(() => StyleSheet.create({
    banner: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: '#fef3c7',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: '#fcd34d',
      gap: 8,
    },
    bannerText: {
      fontSize: 13,
      color: '#92400e',
      lineHeight: 18,
    },
    acceptBtn: {
      alignSelf: 'flex-start' as const,
      backgroundColor: colorss.primary,
      paddingHorizontal: 18,
      paddingVertical: 8,
      borderRadius: 8,
    },
    acceptLabel: { color: '#fff', fontWeight: '600' as const, fontSize: 14 },
    pageBanner: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      backgroundColor: `${colorss.primary}15`,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: `${colorss.primary}40`,
      alignItems: 'center' as const,
    },
    pageBannerText: {
      fontSize: 12,
      color: colorss.primary,
    },
    joinCallBanner: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: `${colorss.success}1A`,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: `${colorss.success}55`,
    },
    joinCallText: {
      flex: 1,
      fontSize: 13,
      color: colorss.textPrimary,
      fontWeight: '600' as const,
    },
    joinCallSub: {
      fontSize: 11,
      color: colorss.textSecondary,
      marginTop: 1,
      fontWeight: '400' as const,
    },
    joinCallBtn: {
      backgroundColor: colorss.success,
      paddingHorizontal: 16,
      paddingVertical: 7,
      borderRadius: 18,
    },
    joinCallBtnText: {
      color: '#FFFFFF',
      fontWeight: '700' as const,
      fontSize: 13,
    },
  }), [colorss]);
  const token = useAppSelector(selectAuthToken);
  const hopenityProfile = useAppSelector(selectHopenityProfile);
  const activePage = useAppSelector(selectActivePage);
  const { setConversations, reloadConversations } = useChats();
  const [acceptBusy, setAcceptBusy] = useState(false);
  const [needsAcceptance, setNeedsAcceptance] = useState(
    !!conversation.needsAcceptance,
  );
  // Booking-linked chat: track whether messaging is allowed.
  // Re-synced on every focus so admin toggles from ConversationAction are reflected.
  const [bookingClosed, setBookingClosed] = useState(false);
  const [bookingStatus, setBookingStatus] = useState<string | undefined>();
  const [bookingCancelStatus, setBookingCancelStatus] = useState<string | undefined>();
  const [bookingMessagingEnabled, setBookingMessagingEnabled] = useState(
    route.params.messagingEnabled ?? true,
  );
  // True when the current user is the callee (creator) on the linked booking.
  // Only the callee can toggle messaging — caller should not see the action.
  const [isBookingCallee, setIsBookingCallee] = useState(false);
  // True when the local user sent the initial request and the other side
  // hasn't accepted yet.  We restrict to 1 outgoing message before acceptance
  // to prevent spam and match the "single intro message" UX pattern.
  const isSentRequest = !!conversation.isSentRequest;

  useEffect(() => {
    setNeedsAcceptance(!!conversation.needsAcceptance);
  }, [conversation.needsAcceptance]);

  // Block means no text AND no call — re-checked on every focus so an
  // in-session block/unblock (from Profile or the conversation menu) is reflected.
  const [isBlocked, setIsBlocked] = useState(false);
  // Reading a chat clears its banner — a shade full of messages the user is
  // currently looking at is the classic "notifications feel broken" complaint.
  useFocusEffect(
    useCallback(() => {
      void clearChatNotification(conversation.id);
      return undefined;
    }, [conversation.id]),
  );

  useFocusEffect(
    useCallback(() => {
      if (!token || conversation.isGroup) return undefined;
      const pageId = activePage?.id ? Number(activePage.id) : undefined;
      fetchHopenityChatDirectory(token, { status: 'blocked', limit: 100, ...(pageId != null ? { pageId } : {}) })
        .then(dir => {
          setIsBlocked(dir.chats.some(c => String(c.id) === String(conversation.id)));
        })
        .catch(() => {});
      return undefined;
    }, [token, conversation.id, conversation.isGroup, activePage?.id]),
  );

  // Re-check booking messagingEnabled each time we return to this screen so
  // that an admin toggle in ConversationActionScreen is reflected immediately.
  // Also determine whether this user is the callee so we can conditionally
  // show the messaging toggle in ConversationAction.
  //
  // bookingId may be absent when the user navigates here from the home screen
  // after a session restart. Fall back to the MMKV-persisted mapping that was
  // written when the booking was first made.
  const resolvedBookingId = route.params.bookingId
    ?? getBookingForChat(conversation.id);

  useFocusEffect(
    useCallback(() => {
      const bookingId = resolvedBookingId;
      if (!bookingId || !token) return undefined;
      Promise.all([
        fetchMyBookings('caller', token).catch(() => []),
        fetchMyBookings('callee', token).catch(() => []),
      ]).then(([booked, received]) => {
        const asCallee = received.find(b => b.id === bookingId);
        const booking = asCallee ?? booked.find(b => b.id === bookingId);
        if (booking != null) {
          setBookingMessagingEnabled(booking.messagingEnabled);
          setBookingStatus(booking.status);
          setBookingCancelStatus(booking.cancelStatus ?? 'NONE');
          // A closed or cancelled booking is history — distinguish it from a
          // plain messaging toggle so the banner can say why.
          setBookingClosed(
            booking.status === 'CLOSED' || booking.status === 'CANCELLED',
          );
        }
        setIsBookingCallee(!!asCallee);
      });
      return undefined;
    }, [resolvedBookingId, token]),
  );

  const handleAcceptRequest = useCallback(async () => {
    if (!token || acceptBusy) return;
    setAcceptBusy(true);
    try {
      const { ok, message } = await acceptHopenityChatRequest(conversation.id, token);
      if (!ok) {
        Alert.alert(
          'Could not accept',
          message ?? 'The request could not be accepted. Please try again.',
        );
        return;
      }
      setNeedsAcceptance(false);
      setConversations(prev =>
        prev.map(c =>
          c.id === conversation.id ? { ...c, needsAcceptance: false } : c,
        ),
      );
      await reloadConversations();
    } finally {
      setAcceptBusy(false);
    }
  }, [
    acceptBusy,
    conversation.id,
    reloadConversations,
    setConversations,
    token,
  ]);

  const {
    messages,
    setText,
    initialText,
    setInitialText,
    user,
    insets,
    refreshTrigger,
    loadingMore,
    hasMore,
    onSend,
    loadEarlier,
    forwardingMessage,
    clearForwarding,
    isEncrypted,
    registerScrollToMessage,
    sellerSheetVisible,
    closeSellerSheet,
    peerIsTyping,
    wordEffect,
  } = useInbox();

  // ── GiftedChat FlatList ref for reply-tap scroll ───────────────────────────
  const messageContainerRef = useRef<any>(null);

  useEffect(() => {
    registerScrollToMessage((targetId) => {
      // messages is newest-first (GiftedChat order); find the index of the target.
      const idx = (messages as IMessage[]).findIndex(
        m => String(m._id) === String(targetId),
      );
      if (idx < 0 || !messageContainerRef.current) return;
      try {
        messageContainerRef.current.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
      } catch {
        // scrollToIndex can throw when the item is not yet rendered; fall back to offset.
        messageContainerRef.current.scrollToEnd?.({ animated: true });
      }
    });
  }, [messages, registerScrollToMessage]);

  useEffect(() => {
    if (!initialText) return;
    const t = setTimeout(() => setInitialText(''), 100);
    return () => clearTimeout(t);
  }, [initialText, setInitialText]);

  const peerName = route.params.displayName ?? conversation.name;

  /**
   * A group's live call. Drives the "Join call" banner so a member who missed
   * the ring can still walk into the conversation that is already happening —
   * previously the only way in was to press call, which started a rival room.
   */
  const [groupCall, setGroupCall] = useState<GroupCallState | null>(null);
  useEffect(() => {
    if (!conversation.isGroup || !token) {
      setGroupCall(null);
      return;
    }
    let cancelled = false;
    void fetchGroupCallState(conversation.id, token).then(state => {
      if (!cancelled) setGroupCall(state?.active ? state : null);
    });
    const unsub = callSocket.onGroupCallState(evt => {
      if (String(evt.threadId) !== String(conversation.id)) return;
      setGroupCall(
        evt.active
          ? {
              active: true,
              liveKitRoom: evt.liveKitRoom,
              callKind: evt.callKind === 'video' ? 'video' : 'audio',
              startedByUserId: evt.startedByUserId,
              startedByName: evt.startedByName,
              participantCount: evt.participantCount,
            }
          : null,
      );
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [conversation.isGroup, conversation.id, token]);

  const joinGroupCall = useCallback(async () => {
    if (!groupCall?.liveKitRoom) return;
    const kind = groupCall.callKind === 'video' ? 'video' : 'audio';
    if (!(await ensureCallPermissions(kind))) return;
    if (token) {
      // Registers us as a participant and posts "{name} joined the call".
      void notifyGroupCall({
        groupId: conversation.id,
        liveKitRoom: groupCall.liveKitRoom,
        callKind: kind,
        token,
        displayName: peerName,
      });
    }
    navigation.navigate(kind === 'video' ? 'VideoCall' : 'AudioCall', {
      displayName: peerName,
      liveKitRoom: groupCall.liveKitRoom,
      avatarUrl: route.params.avatarUrl ?? conversation.avatarUrl,
      conversationId: conversation.id,
      // Joining an in-progress call: not an outgoing ring.
      callDirection: 'incoming',
      isGroupCall: true,
    });
  }, [
    groupCall,
    token,
    conversation.id,
    conversation.avatarUrl,
    peerName,
    navigation,
    route.params.avatarUrl,
  ]);

  const audioRoom = useMemo(
    () =>
      resolveLiveKitRoomName({
        explicitRoom: route.params.liveKitRoom,
        conversationId: conversation.id,
        peerUserId: conversation.peerUserId,
        localUserId: normalizeChatUserId(user._id),
        isGroup: conversation.isGroup,
      }),
    [
      route.params.liveKitRoom,
      conversation.id,
      conversation.peerUserId,
      conversation.isGroup,
      user._id,
    ],
  );

  const headerStatus = useMemo(() => {
    if (conversation.isGroup) {
      const total = conversation.groupMemberCount;
      const online = conversation.groupOnlineCount ?? 0;
      if (!total) return '';
      if (online > 0) return `${total} members, ${online} online`;
      return `${total} members`;
    }
    if (conversation.isOnline === true) {
      return 'Online';
    }
    if (
      conversation.lastSeenAt != null &&
      String(conversation.lastSeenAt).trim() !== ''
    ) {
      return formatLastSeenLine(conversation.lastSeenAt);
    }
    return '';
  }, [
    conversation.isGroup,
    conversation.groupMemberCount,
    conversation.groupOnlineCount,
    conversation.isOnline,
    conversation.lastSeenAt,
  ]);

  // Re-read local appearance whenever the screen comes into focus (e.g. after
  // the user changes their theme or reactions in ThemeScreen / ReactionsScreen).
  const [localAppearance, setLocalAppearance] = useState(
    () => getEffectiveAppearance(conversation.id),
  );
  const convIdRef = useRef(conversation.id);
  convIdRef.current = conversation.id;
  useFocusEffect(
    useCallback(() => {
      setLocalAppearance(getEffectiveAppearance(convIdRef.current));
    }, []),
  );

  // Chat background priority:
  //   1. Server-provided wallpaper (remoteWallpaperUrl)
  //   2. Per-conversation custom wallpaper URI (explicitly set for THIS chat)
  //   3. Per-conversation theme preset image (explicitly set for THIS chat)
  //
  // Global theme/wallpaper is intentionally NOT used here — it would bleed into
  // every chat. Global appearance affects the app chrome (dark mode, accent), not
  // individual chat backgrounds.
  const chatWallpaperSource: { uri: string } | number | null = (() => {
    if (conversation.remoteWallpaperUrl) {
      return { uri: conversation.remoteWallpaperUrl };
    }
    const convPrefs = getConvAppearance(conversation.id);
    if (convPrefs.wallpaperUri) {
      return { uri: convPrefs.wallpaperUri };
    }
    const preset = convPrefs.themePresetId;
    if (preset && preset > 1 && PRESET_IMAGES[preset]) {
      return PRESET_IMAGES[preset];
    }
    return null;
  })();

  // A post handed over from Hopenity's share sheet. Held as state so dismissing
  // it (or sending it) clears the bar without needing a navigation param change.
  const [pendingShare, setPendingShare] = useState<PendingShare | null>(
    route.params.pendingShare ?? null,
  );
  const [sharingPost, setSharingPost] = useState(false);

  // route.params.pendingShare only seeds the initial mount — when this screen is
  // already focused (user shares again into the same open chat), React Navigation
  // merges the new params into the existing route without remounting, so the
  // useState initializer above never re-runs. Sync it live instead.
  useEffect(() => {
    if (route.params.pendingShare) {
      setPendingShare(route.params.pendingShare);
    }
  }, [route.params.pendingShare]);

  const sendPendingShare = useCallback(async () => {
    const share = pendingShare;
    if (!share || sharingPost) return;
    setSharingPost(true);
    try {
      // The post link IS the message — HopeChat renders link previews for it,
      // and it stays readable on any client that does not.
      await onSend([
        {
          _id: String(Date.now()),
          text: share.url,
          createdAt: new Date(),
          user: { _id: user._id },
        } as ExtendedMessage,
      ]);
      setPendingShare(null);
    } finally {
      setSharingPost(false);
    }
  }, [pendingShare, sharingPost, onSend, user._id]);

  /**
   * Props gifted-chat v3 accepts at runtime but does not expose in its public
   * types (this element also passes `placeholder` and `textInputProps`). Spread
   * as a loose record so naming them does not switch on JSX excess-property
   * checking for the whole element.
   *
   * `messagesContainerRef` is the v3 name — it used to be passed as
   * `messageContainerRef`, which the library silently ignored, so reply-tap
   * scroll-to-message never worked.
   */
  const giftedChatCompatProps: Record<string, unknown> = {
    messagesContainerRef: messageContainerRef,
  };

  const renderInputToolbar = useCallback(
    (p: unknown) => (
      <>
        {pendingShare ? (
          <SharePreviewBar
            share={pendingShare}
            sending={sharingPost}
            onSend={sendPendingShare}
            onDismiss={() => setPendingShare(null)}
          />
        ) : null}
        <CustomInputToolbar {...(p as object)} />
      </>
    ),
    [pendingShare, sharingPost, sendPendingShare],
  );

  const renderTime = useCallback((props: TimeProps<IMessage>) => {
    const msg = props.currentMessage;
    if (
      !msg ||
      msg._id === 'system-logo' ||
      msg.system ||
      (msg as ExtendedMessage).threadIntro
    ) {
      return null;
    }
    return (
      <Time
        {...props}
        timeTextStyle={{
          left: { color: colorss.textSecondary },
          right: { color: 'rgba(255,255,255,0.75)' },
        }}
      />
    );
  }, []);

  const renderMessage = useCallback(
    (props: MessageProps<IMessage>) => {
      const raw = props.currentMessage as ExtendedMessage;
      if (raw.threadIntro) {
        return (
          <ChatMessageBox
            {...props}
            refreshTrigger={refreshTrigger}
            onPressReactions={() => navigation.navigate('Reactions')}
          />
        );
      }
      if ((props.currentMessage as IMessage)?.system) {
        return (
          <ChatMessageBox
            {...props}
            position="left"
            refreshTrigger={refreshTrigger}
            onPressReactions={() => navigation.navigate('Reactions')}
          />
        );
      }
      const ext = raw as ExtendedMessage;
      const localId =
        normalizeChatUserId(user?._id) ||
        normalizeChatUserId(hopenityProfile?.userId) ||
        '';
      const senderRaw = String(props.currentMessage?.user?._id ?? '');
      const senderId = normalizeChatUserId(senderRaw) || senderRaw;
      const hint = ext.outgoingHint;
      const matchIds = (): boolean => {
        if (!localId || !senderId) return false;
        if (localId === senderId) return true;
        if (
          /^\d+$/.test(localId) &&
          /^\d+$/.test(senderId) &&
          Number(localId) === Number(senderId)
        ) {
          return true;
        }
        return false;
      };
      const idEq = (a: string, b: string): boolean => {
        if (!a || !b) return false;
        if (a === b) return true;
        if (/^\d+$/.test(a) && /^\d+$/.test(b) && Number(a) === Number(b)) {
          return true;
        }
        return false;
      };
      let isOwn: boolean;
      if (hint === true) {
        isOwn = true;
      } else if (hint === false) {
        isOwn = false;
      } else {
        const peerRaw = conversation.peerUserId
          ? String(conversation.peerUserId)
          : '';
        const peerId = peerRaw ? normalizeChatUserId(peerRaw) || peerRaw : '';
        if (
          peerId &&
          senderId &&
          (idEq(senderId, peerId) || idEq(senderRaw, peerRaw))
        ) {
          isOwn = false;
        } else if (localId && senderId && idEq(senderId, localId)) {
          isOwn = true;
        } else {
          isOwn = matchIds();
        }
      }
      const position: 'left' | 'right' = isOwn ? 'right' : 'left';
      return (
        <ChatMessageBox
          {...props}
          position={position}
          isGroup={conversation.isGroup}
          refreshTrigger={refreshTrigger}
          onPressReactions={() => navigation.navigate('Reactions')}
          onSenderPress={(senderId) => {
            // resolvedUid falls back to the literal string 'unknown' when the
            // sender couldn't be matched to local/peer — opening that as a
            // deep link silently fails on Hopenity's side (no such user).
            if (!senderId || senderId === 'unknown') return;
            openHopenityProfile(senderId).catch(() => {});
          }}
        />
      );
    },
    [
      refreshTrigger,
      navigation,
      user?._id,
      hopenityProfile?.userId,
      conversation.peerUserId,
      conversation.isGroup,
    ],
  );

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colorss.primary }}
      edges={['top', 'left', 'right']}
    >
      <MessageHeader
        name={peerName}
        isVerified={!conversation.isGroup && !!conversation.peerIsVerified}
        status={headerStatus}
        avatarUri={route.params.avatarUrl ?? conversation.avatarUrl}
        isEncrypted={isEncrypted}
        onProfilePress={() => {
          if (conversation.isGroup) {
            navigation.navigate('GroupInfo', {
              groupId: conversation.id,
              conversationId: conversation.id,
            });
          } else {
            navigation.navigate('Profile', {
              userId: conversation.id,
              peerUserId: conversation.peerUserId ?? undefined,
            });
          }
        }}
        onBackPress={() => navigation.navigate('BottomTab', { screen: 'Home' })}
        // Calls are blocked on REQUESTED conversations (both directions) —
        // the chat must be accepted before voice/video calls are allowed.
        // Booking callers (the person who booked) also cannot initiate calls —
        // only the callee (expert) can call when the scheduled time arrives.
        onAudioCall={needsAcceptance || isSentRequest ? undefined : async () => {
          if (isBlocked) {
            Toast.info("You can't call this user — you've blocked them.");
            return;
          }
          if (resolvedBookingId && !isBookingCallee) {
            Toast.info("You can't call directly. The expert will call you at the scheduled time.");
            return;
          }
          // Ask before ringing the peer — a denial here must not leave them
          // with a ringing call we can never join.
          if (!(await ensureCallPermissions('audio'))) return;
          // Placing a call in a room we ourselves marked cancelled (previous
          // attempt) must not be suppressed — room names repeat for a pair.
          clearCallCancelled(audioRoom);
          const isGroupDispatch = conversation.isGroup || !!route.params.isGroupBooking;
          // A group has ONE call: the server hands back the room of a call that
          // is already running, so this joins it rather than opening a second
          // room beside the people already talking.
          let dispatchRoom = audioRoom;
          if (isGroupDispatch) {
            if (token) {
              const res = await notifyGroupCall({
                groupId: conversation.id,
                liveKitRoom: audioRoom,
                callKind: 'audio',
                token,
                displayName: peerName,
              });
              if (res?.liveKitRoom) dispatchRoom = res.liveKitRoom;
            }
          } else {
            // Stop on a deliberate refusal — see notifyPeerIncomingHopeChatCall.
            const ring = await notifyPeerIncomingHopeChatCall({
              token,
              conversationId: conversation.id,
              liveKitRoom: audioRoom,
              callKind: 'audio',
            });
            if (!ring.ok && ring.refused) {
              Toast.show(ring.message, 'error');
              return;
            }
          }
          navigation.navigate('AudioCall', {
            displayName: peerName,
            liveKitRoom: dispatchRoom,
            avatarUrl: route.params.avatarUrl ?? conversation.avatarUrl,
            conversationId: conversation.id,
            peerUserId: conversation.peerUserId ?? undefined,
            callDirection: 'outgoing',
            isGroupCall: isGroupDispatch,
          });
        }}
        onVideoCall={needsAcceptance || isSentRequest ? undefined : async () => {
          if (isBlocked) {
            Toast.info("You can't call this user — you've blocked them.");
            return;
          }
          if (resolvedBookingId && !isBookingCallee) {
            Toast.info("You can't call directly. The expert will call you at the scheduled time.");
            return;
          }
          // Ask before ringing the peer — a denial here must not leave them
          // with a ringing call we can never join.
          if (!(await ensureCallPermissions('video'))) return;
          // Placing a call in a room we ourselves marked cancelled (previous
          // attempt) must not be suppressed — room names repeat for a pair.
          clearCallCancelled(audioRoom);
          const isGroupDispatch = conversation.isGroup || !!route.params.isGroupBooking;
          // Join the group's live call when there is one — see the audio path.
          let dispatchRoom = audioRoom;
          if (isGroupDispatch) {
            if (token) {
              const res = await notifyGroupCall({
                groupId: conversation.id,
                liveKitRoom: audioRoom,
                callKind: 'video',
                token,
                displayName: peerName,
              });
              if (res?.liveKitRoom) dispatchRoom = res.liveKitRoom;
            }
          } else {
            const ring = await notifyPeerIncomingHopeChatCall({
              token,
              conversationId: conversation.id,
              liveKitRoom: audioRoom,
              callKind: 'video',
            });
            if (!ring.ok && ring.refused) {
              Toast.show(ring.message, 'error');
              return;
            }
          }
          navigation.navigate('VideoCall', {
            displayName: peerName,
            liveKitRoom: dispatchRoom,
            avatarUrl: route.params.avatarUrl ?? conversation.avatarUrl,
            conversationId: conversation.id,
            peerUserId: conversation.peerUserId ?? undefined,
            callDirection: 'outgoing',
            isGroupCall: isGroupDispatch,
          });
        }}
        onMorePress={() =>
          navigation.navigate('ConversationAction', {
            conversationId: conversation.id,
            conversationName: peerName,
            isGroup: conversation.isGroup,
            isV1Chat: conversation.isV1Chat,
            peerUserId: conversation.peerUserId ?? undefined,
            isPinned: !!conversation.pinned,
            isMuted: !!conversation.isMuted,
            bookingId: resolvedBookingId,
            messagingEnabled: bookingMessagingEnabled,
            bookingStatus,
            bookingCancelStatus,
            isBookingCallee,
          })
        }
      />

      {/* A call is live in this group — offer to walk into it. */}
      {conversation.isGroup && groupCall?.active ? (
        <View style={acceptStyles.joinCallBanner}>
          {groupCall.callKind === 'video' ? (
            <VideoIcon size={18} color={colorss.success} />
          ) : (
            <PhoneIcon size={18} color={colorss.success} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={acceptStyles.joinCallText} numberOfLines={1}>
              {groupCall.callKind === 'video' ? 'Video call' : 'Audio call'} in
              progress
            </Text>
            <Text style={acceptStyles.joinCallSub} numberOfLines={1}>
              {groupCall.participantCount > 0
                ? `${groupCall.participantCount} in the call`
                : `Started by ${groupCall.startedByName ?? 'someone'}`}
            </Text>
          </View>
          <TouchableOpacity
            style={acceptStyles.joinCallBtn}
            onPress={() => void joinGroupCall()}
            activeOpacity={0.8}
          >
            <Text style={acceptStyles.joinCallBtnText}>Join</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {activePage && (
        <View style={acceptStyles.pageBanner}>
          <Text style={acceptStyles.pageBannerText}>
            Sending as <Text style={{ fontWeight: '700' }}>{activePage.name}</Text>
          </Text>
        </View>
      )}

      {(() => {
        // Incoming request: recipient sees Accept banner, input is locked.
        const requestBanner = needsAcceptance ? (
          <View style={acceptStyles.banner}>
            <Text style={acceptStyles.bannerText}>
              Accept this request to reply. The sender will not be notified
              until you reply.
            </Text>
            <TouchableOpacity
              style={acceptStyles.acceptBtn}
              onPress={handleAcceptRequest}
              disabled={acceptBusy}
            >
              {acceptBusy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={acceptStyles.acceptLabel}>Accept</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null;

        // Outgoing request: sender already sent 1 message.  Lock the input
        // until the other person accepts — prevents spam and matches the
        // "single intro message" pattern (like Instagram DM requests).
        const sentCount = messages.filter(m => {
          const uid = normalizeChatUserId((m as any).user?._id);
          return uid === (normalizeChatUserId(user?._id) || 'me');
        }).length;
        const sentRequestLocked = isSentRequest && sentCount >= 1;

        const sentRequestBanner = sentRequestLocked ? (
          <View style={acceptStyles.banner}>
            <Text style={acceptStyles.bannerText}>
              ✉️ Your message has been sent.{'\n'}
              You can send more once {conversation.name || 'they'} accepts the request.
            </Text>
          </View>
        ) : null;

        const messagingRestrictedBanner = !bookingMessagingEnabled ? (
          <View style={acceptStyles.banner}>
            <Text style={acceptStyles.bannerText}>
              {bookingClosed
                ? '✓ This booking has ended. The conversation is read-only history.'
                : '🚫 Messaging has been restricted for this booking.'}
            </Text>
          </View>
        ) : null;

        const inputLocked = needsAcceptance || sentRequestLocked || !bookingMessagingEnabled;

        const mainChat = (
          <GiftedChat
            // gifted-chat v3 renamed this to messagesContainerRef; the old name was
            // silently ignored, so reply-tap scroll-to-message never worked.
            // gifted-chat v3 renamed this to messagesContainerRef; the old name was
            // silently ignored, so reply-tap scroll-to-message never worked. Cast
            // because several other props on this element (placeholder,
            // textInputProps) are outside the library's public types, and naming a
            // valid prop directly turns on excess-property checking for all of them.
            {...giftedChatCompatProps}
            // `placeholder` is not a GiftedChat v3 prop — it belongs to the text
            // input. Passing it at the top level was silently ignored, which is
            // why the composer always read "Type here…" even when the thread was
            // locked awaiting acceptance.
            textInputProps={{
              editable: !inputLocked,
              placeholder: needsAcceptance
                ? 'Accept the request above to reply…'
                : sentRequestLocked
                  ? 'Waiting for acceptance…'
                  : !bookingMessagingEnabled
                    ? bookingClosed
                      ? 'This booking has ended…'
                      : 'Messaging restricted for this booking…'
                    : 'Type here…',
            }}
            messages={messages as unknown as IMessage[]}
            // ALWAYS pass text. This used to be a conditional spread —
            // `{...(initialText ? { text: initialText } : {})}` — which flipped
            // GiftedChat between controlled and uncontrolled at runtime: it was
            // controlled while initialText was set, then went uncontrolled 100ms
            // later when initialText cleared. GiftedChat's internal text state
            // reset to '' on that switch, so the toolbar saw props.text === ''
            // while characters were still on screen, and swapped the Send button
            // for the thumbs-up. Controlled throughout, driven by
            // onInputTextChanged below.
            // GiftedChat stays UNCONTROLLED.
            //
            // Passing `text` made it controlled, but nothing in this app ever
            // clears that state after a send — so the prop fought the composer's
            // own value and wiped what the user was typing. The send button's
            // dependence on props.text is handled inside CustomInputToolbar
            // instead, which falls back to the context value.
            //
            // Do NOT reintroduce a conditional `{...(cond ? { text } : {})}`
            // either: flipping controlled/uncontrolled at runtime is what made
            // the Send button disappear mid-typing.
            onSend={(msgs: IMessage[]) => onSend(msgs as ExtendedMessage[])}
            // @ts-ignore
            onInputTextChanged={setText}
            user={{
              _id: normalizeChatUserId(user?._id) || 'me',
              name: typeof user?.name === 'string' ? user.name : undefined,
            }}
            renderTime={renderTime}
            renderAvatar={() => null}
            minComposerHeight={36}
            maxComposerHeight={132}
            alwaysShowSend
            renderInputToolbar={renderInputToolbar}
            renderMessage={renderMessage}
            isTyping={peerIsTyping}
            loadEarlier={hasMore}
            infiniteScroll
            renderLoadEarlier={() => <></>}
            onLoadEarlier={loadEarlier}
            isLoadingEarlier={loadingMore}
            keyboardShouldPersistTaps="handled"
            timeFormat="LT"
            bottomOffset={insets.bottom}
            renderDay={props => {
              const systemMessageId = '__hopenity_thread_intro';
              if (props.currentMessage?._id === systemMessageId) {
                return null;
              }

              return <Day {...props} />;
            }}
            keyboardAvoidingViewProps={{
              keyboardVerticalOffset: insets.top + 60,
            }}
          />
        );

        return chatWallpaperSource ? (
          <ImageBackground
            source={chatWallpaperSource}
            style={{ flex: 1, backgroundColor: colorss.background }}
            imageStyle={{ opacity: 0.4 }}
          >
            <View
              style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.02)' }}
            >
              {requestBanner}
              {sentRequestBanner}
              {messagingRestrictedBanner}
              {mainChat}
            </View>
          </ImageBackground>
        ) : (
          <View style={{ flex: 1, backgroundColor: colorss.background }}>
            {requestBanner}
            {sentRequestBanner}
            {messagingRestrictedBanner}
            {mainChat}
          </View>
        );
      })()}
      {/* Word-effect burst — above the thread, below the modals. */}
      <WordEffectOverlay
        emoji={wordEffect.emoji}
        burstId={wordEffect.burstId}
      />
      {forwardingMessage && (
        <ForwardModal message={forwardingMessage} onClose={clearForwarding} />
      )}
      <ShopSheet
        visible={sellerSheetVisible}
        hopenityToken={token}
        onClose={closeSellerSheet}
        onSelectProduct={(url: string) => {
          onSend([{ _id: String(Date.now()), text: url, createdAt: new Date(), user: { _id: user._id } } as ExtendedMessage]);
        }}
      />
    </SafeAreaView>
  );
};


const InboxGate: React.FC<Props> = props => {
  const colorss = useColors();
  const { conversations, listLoading } = useChats();
  const id = props.route.params.conversationId;
  const seed = props.route.params.seedConversation;

  /**
   * Resolve the conversation for this screen.
   *
   * A THIRD source was added: the route params themselves. Opening a chat from a
   * notification or a deep link passes only conversationId + displayName, so when
   * the in-memory list had not loaded yet (cold start, or after an identity
   * switch clears it) this screen rendered "Conversation not found" for a chat
   * that exists perfectly well. A params-derived stub lets the thread mount
   * immediately; the real row replaces it as soon as the list arrives.
   */
  const conv = useMemo(() => {
    const found = conversations.find(c => c.id === id);
    if (found) return found;
    if (seed?.id === id) {
      return { ...seed, messages: seed.messages?.length ? seed.messages : [] };
    }
    if (!id) return undefined;
    return {
      id,
      name: props.route.params.displayName ?? '',
      avatarUrl: props.route.params.avatarUrl ?? null,
      isGroup: !!props.route.params.isGroupBooking,
      needsAcceptance: false,
      preview: '',
      time: '',
      unreadCount: 0,
      messages: [],
    } as ConversationSummary;
  }, [
    conversations,
    id,
    seed,
    props.route.params.displayName,
    props.route.params.avatarUrl,
    props.route.params.isGroupBooking,
  ]);

  const threadIntroPeer = useMemo(() => {
    const name = props.route.params.displayName?.trim() || conv?.name || '';
    const avatarUrl = props.route.params.avatarUrl ?? conv?.avatarUrl ?? null;

    // Groups: show member count instead of friendship status
    if (conv?.isGroup) {
      const count = conv?.groupMemberCount;
      return {
        name,
        avatarUrl,
        subtitle: count ? `${count} people in this group` : 'Group chat',
        prompt: 'Say hello to the group!',
      };
    }

    // 1-to-1: subtitle depends on relationship
    let subtitle: string;
    if (conv?.needsAcceptance) {
      subtitle = 'Wants to connect with you on Hopenity';
    } else if (conv?.peerUserId) {
      subtitle = "You're friends on Hopenity";
    } else {
      subtitle = 'Hopenity user';
    }
    return { name, avatarUrl, subtitle };
  }, [
    conv?.avatarUrl,
    conv?.groupMemberCount,
    conv?.isGroup,
    conv?.name,
    conv?.needsAcceptance,
    conv?.peerUserId,
    props.route.params.avatarUrl,
    props.route.params.displayName,
  ]);

  // Bail-out AFTER every hook. This used to sit above `useMemo`, so the hook
  // count changed between the "not found" and "found" renders — React's
  // "rendered fewer hooks than expected" error, which unmounts the tree and
  // leaves a black screen. Never early-return before hooks.
  if (!conv) {
    return (
      <SafeAreaView
        style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
      >
        <Text style={{ color: colorss.textSecondary }}>
          {listLoading ? 'Loading…' : 'Conversation not found.'}
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <InboxProvider
      key={conv.id}
      conversationId={conv.id}
      seedMessages={conv.messages}
      threadIntroPeer={threadIntroPeer}
      peerUserId={conv.peerUserId ?? null}
      isGroup={!!conv.isGroup}
      isV1Chat={!!conv.isV1Chat}
      remoteReactionPalette={conv.remoteReactionPalette ?? null}
    >
      <InboxScreenInner {...props} conversation={conv} />
    </InboxProvider>
  );
};

const InboxScreen: React.FC<Props> = p => <InboxGate {...p} />;

export default React.memo(InboxScreen);
