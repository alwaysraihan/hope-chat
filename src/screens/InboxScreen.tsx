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
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';

import { InboxProvider, useInbox } from '../context/InboxContext';
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
import { useAppSelector } from '../hooks/redux';
import { normalizeChatUserId } from '../utils/chatUserId';
import { resolveLiveKitRoomName } from '../utils/livekitRoomId';
import { notifyPeerIncomingHopeChatCall } from '../services/invitePeerToHopeChatCall';
import { notifyGroupCall } from '../services/groupService';
import { getEffectiveAppearance, getConvAppearance } from '../services/chatPrefs';
import { Toast } from '../components/Toast';
import { THEME_1, THEME_2, THEME_3, THEME_4, THEME_5 } from '../assets';
import { formatLastSeenLine } from '../utils/formatLastSeen';
import { selectActivePage } from '../redux/features/auth/authSlice';
import { openHopenityProfile } from '../services/hopenityLinking';
import { SellerProductSheet } from '../components/message/SellerProductSheet';

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
  useFocusEffect(
    useCallback(() => {
      if (!token || conversation.isGroup) return undefined;
      fetchHopenityChatDirectory(token, { status: 'blocked', limit: 100 })
        .then(dir => {
          setIsBlocked(dir.chats.some(c => String(c.id) === String(conversation.id)));
        })
        .catch(() => {});
      return undefined;
    }, [token, conversation.id, conversation.isGroup]),
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
        if (booking != null) setBookingMessagingEnabled(booking.messagingEnabled);
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
  const peerName = route.params.displayName ?? conversation.name;

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

  const renderInputToolbar = useCallback(
    (p: unknown) => <CustomInputToolbar {...(p as object)} />,
    [],
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
        onAudioCall={needsAcceptance || isSentRequest ? undefined : () => {
          if (isBlocked) {
            Toast.info("You can't call this user — you've blocked them.");
            return;
          }
          if (resolvedBookingId && !isBookingCallee) {
            Toast.info("You can't call directly. The expert will call you at the scheduled time.");
            return;
          }
          const isGroupDispatch = conversation.isGroup || !!route.params.isGroupBooking;
          if (isGroupDispatch) {
            if (token) {
              notifyGroupCall({
                groupId: conversation.id,
                liveKitRoom: audioRoom,
                callKind: 'audio',
                token,
                displayName: peerName,
              });
            }
          } else {
            notifyPeerIncomingHopeChatCall({
              token,
              conversationId: conversation.id,
              liveKitRoom: audioRoom,
              callKind: 'audio',
            });
          }
          navigation.navigate('AudioCall', {
            displayName: peerName,
            liveKitRoom: audioRoom,
            avatarUrl: route.params.avatarUrl ?? conversation.avatarUrl,
            conversationId: conversation.id,
            peerUserId: conversation.peerUserId ?? undefined,
            callDirection: 'outgoing',
            isGroupCall: isGroupDispatch,
          });
        }}
        onVideoCall={needsAcceptance || isSentRequest ? undefined : () => {
          if (isBlocked) {
            Toast.info("You can't call this user — you've blocked them.");
            return;
          }
          if (resolvedBookingId && !isBookingCallee) {
            Toast.info("You can't call directly. The expert will call you at the scheduled time.");
            return;
          }
          const isGroupDispatch = conversation.isGroup || !!route.params.isGroupBooking;
          if (isGroupDispatch) {
            if (token) {
              notifyGroupCall({
                groupId: conversation.id,
                liveKitRoom: audioRoom,
                callKind: 'video',
                token,
                displayName: peerName,
              });
            }
          } else {
            notifyPeerIncomingHopeChatCall({
              token,
              conversationId: conversation.id,
              liveKitRoom: audioRoom,
              callKind: 'video',
            });
          }
          navigation.navigate('VideoCall', {
            displayName: peerName,
            liveKitRoom: audioRoom,
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
            isBookingCallee,
          })
        }
      />

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
              🚫 Messaging has been restricted for this booking.
            </Text>
          </View>
        ) : null;

        const inputLocked = needsAcceptance || sentRequestLocked || !bookingMessagingEnabled;

        const mainChat = (
          <GiftedChat
            messageContainerRef={messageContainerRef}
            placeholder={
              needsAcceptance
                ? 'Accept the request above to reply…'
                : sentRequestLocked
                  ? 'Waiting for acceptance…'
                  : !bookingMessagingEnabled
                    ? 'Messaging restricted for this booking…'
                    : 'Type here…'
            }
            textInputProps={{ editable: !inputLocked }}
            messages={messages as unknown as IMessage[]}
            {...(initialText ? { text: initialText } : {})}
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
            maxComposerHeight={108}
            alwaysShowSend
            renderInputToolbar={renderInputToolbar}
            renderMessage={renderMessage}
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
      {forwardingMessage && (
        <ForwardModal message={forwardingMessage} onClose={clearForwarding} />
      )}
      <SellerProductSheet
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
  const { conversations } = useChats();
  const id = props.route.params.conversationId;
  const seed = props.route.params.seedConversation;
  const conv =
    conversations.find(c => c.id === id) ??
    (seed?.id === id
      ? { ...seed, messages: seed.messages?.length ? seed.messages : [] }
      : undefined);

  if (!conv) {
    return (
      <SafeAreaView
        style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
      >
        <Text style={{ color: colorss.textSecondary }}>
          Conversation not found.
        </Text>
      </SafeAreaView>
    );
  }

  const threadIntroPeer = useMemo(() => {
    const name = props.route.params.displayName?.trim() || conv.name;
    const avatarUrl = props.route.params.avatarUrl ?? conv.avatarUrl ?? null;

    // Groups: show member count instead of friendship status
    if (conv.isGroup) {
      const count = conv.groupMemberCount;
      return {
        name,
        avatarUrl,
        subtitle: count ? `${count} people in this group` : 'Group chat',
        prompt: 'Say hello to the group!',
      };
    }

    // 1-to-1: subtitle depends on relationship
    let subtitle: string;
    if (conv.needsAcceptance) {
      subtitle = 'Wants to connect with you on Hopenity';
    } else if (conv.peerUserId) {
      subtitle = "You're friends on Hopenity";
    } else {
      subtitle = 'Hopenity user';
    }
    return { name, avatarUrl, subtitle };
  }, [
    conv.avatarUrl,
    conv.groupMemberCount,
    conv.isGroup,
    conv.name,
    conv.needsAcceptance,
    conv.peerUserId,
    props.route.params.avatarUrl,
    props.route.params.displayName,
  ]);

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
