import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ImageBackground,
} from 'react-native';
import {
  GiftedChat,
  IMessage,
  MessageProps,
  Time,
  TimeProps,
} from 'react-native-gifted-chat';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { InboxProvider, useInbox } from '../context/InboxContext';
import ChatMessageBox from '../components/message/ChatMessageBox';
import MessageHeader from '../components/message/MessageHeader';
import CustomInputToolbar from '../components/message/CustomInputToolbar';
import { colorss } from '../theme';
import { RootStackNavigatorParamList } from '../types/navigators';
import type { ConversationSummary } from '../context/ChatsContext';
import { useChats } from '../context/ChatsContext';
import type { ExtendedMessage } from '../components/types/chat';
import { acceptHopenityChatRequest } from '../services/chatService';
import { selectAuthToken, selectHopenityProfile } from '../redux/features/auth/authSlice';
import { useAppSelector } from '../hooks/redux';
import { normalizeChatUserId } from '../utils/chatUserId';
import { resolveLiveKitRoomName } from '../utils/livekitRoomId';
import { notifyPeerIncomingHopeChatCall } from '../services/invitePeerToHopeChatCall';
import { getChatAppearance } from '../services/chatPrefs';
import { formatLastSeenLine } from '../utils/formatLastSeen';

type Props = NativeStackScreenProps<RootStackNavigatorParamList, 'Inbox'>;

const InboxScreenInner: React.FC<
  Props & { conversation: ConversationSummary }
> = ({ navigation, route, conversation }) => {
  const token = useAppSelector(selectAuthToken);
  const hopenityProfile = useAppSelector(selectHopenityProfile);
  const { setConversations, reloadConversations } = useChats();
  const [acceptBusy, setAcceptBusy] = useState(false);
  const [needsAcceptance, setNeedsAcceptance] = useState(
    !!conversation.needsAcceptance,
  );

  useEffect(() => {
    setNeedsAcceptance(!!conversation.needsAcceptance);
  }, [conversation.needsAcceptance]);

  const handleAcceptRequest = useCallback(async () => {
    if (!token || acceptBusy) return;
    setAcceptBusy(true);
    try {
      const ok = await acceptHopenityChatRequest(conversation.id, token);
      if (!ok) return;
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
  } = useInbox();

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
  const peerName =
    route.params.displayName ?? conversation.name;

  const headerStatus = useMemo(() => {
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
  }, [conversation.isOnline, conversation.lastSeenAt]);

  const chatWallpaperUri =
    conversation.remoteWallpaperUrl ??
    getChatAppearance().wallpaperUri ??
    null;

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
        if (
          /^\d+$/.test(a) &&
          /^\d+$/.test(b) &&
          Number(a) === Number(b)
        ) {
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
        const peerId = peerRaw
          ? normalizeChatUserId(peerRaw) || peerRaw
          : '';
        if (
          peerId &&
          senderId &&
          (idEq(senderId, peerId) ||
            idEq(senderRaw, peerRaw))
        ) {
          isOwn = false;
        } else if (
          localId &&
          senderId &&
          idEq(senderId, localId)
        ) {
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
          refreshTrigger={refreshTrigger}
          onPressReactions={() => navigation.navigate('Reactions')}
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
        onProfilePress={() =>
          navigation.navigate('Profile', {
            userId: conversation.id,
          })
        }
        onBackPress={() => navigation.navigate('BottomTab', { screen: 'Home' })}
        onAudioCall={() => {
          void notifyPeerIncomingHopeChatCall({
            token,
            conversationId: conversation.id,
            liveKitRoom: audioRoom,
            callKind: 'audio',
          });
          navigation.navigate('AudioCall', {
            displayName: peerName,
            liveKitRoom: audioRoom,
            avatarUrl: route.params.avatarUrl ?? conversation.avatarUrl,
            conversationId: conversation.id,
            peerUserId: conversation.peerUserId ?? undefined,
            callDirection: 'outgoing',
          });
        }}
        onVideoCall={() => {
          void notifyPeerIncomingHopeChatCall({
            token,
            conversationId: conversation.id,
            liveKitRoom: audioRoom,
            callKind: 'video',
          });
          navigation.navigate('VideoCall', {
            displayName: peerName,
            liveKitRoom: audioRoom,
            avatarUrl: route.params.avatarUrl ?? conversation.avatarUrl,
            conversationId: conversation.id,
            peerUserId: conversation.peerUserId ?? undefined,
            callDirection: 'outgoing',
          });
        }}
      />

      {(() => {
        const requestBanner = needsAcceptance ? (
          <View style={acceptStyles.banner}>
            <Text style={acceptStyles.bannerText}>
              Accept this request to reply. The sender will not be notified until you
              reply.
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

        const mainChat = (
          <GiftedChat
            placeholder={
              needsAcceptance ? 'Accept the request above to reply…' : 'Type here…'
            }
            textInputProps={{ editable: !needsAcceptance }}
            messages={messages as unknown as IMessage[]}
            {...(initialText ? { text: initialText } : {})}
            onSend={(msgs: IMessage[]) =>
              onSend(msgs as ExtendedMessage[])
            }
            onInputTextChanged={setText}
            user={{
              _id: normalizeChatUserId(user?._id) || 'me',
              name: typeof user?.name === 'string' ? user.name : undefined,
            }}
            renderTime={renderTime}
            renderAvatar={() => null}
            maxComposerHeight={100}
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
            keyboardAvoidingViewProps={{
              keyboardVerticalOffset: insets.top + 60,
            }}
          />
        );

        return chatWallpaperUri ? (
          <ImageBackground
            source={{ uri: chatWallpaperUri }}
            style={{ flex: 1, backgroundColor: colorss.background }}
            imageStyle={{ opacity: 0.4 }}
          >
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.02)' }}>
              {requestBanner}
              {mainChat}
            </View>
          </ImageBackground>
        ) : (
          <View style={{ flex: 1, backgroundColor: colorss.background }}>
            {requestBanner}
            {mainChat}
          </View>
        );
      })()}
    </SafeAreaView>
  );
};

const acceptStyles = StyleSheet.create({
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
    alignSelf: 'flex-start',
    backgroundColor: colorss.primary,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 8,
  },
  acceptLabel: { color: '#fff', fontWeight: '600', fontSize: 14 },
});

const InboxGate: React.FC<Props> = props => {
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

  const threadIntroPeer = useMemo(
    () => ({
      name: props.route.params.displayName?.trim() || conv.name,
      avatarUrl: props.route.params.avatarUrl ?? conv.avatarUrl ?? null,
    }),
    [
      conv.avatarUrl,
      conv.name,
      props.route.params.avatarUrl,
      props.route.params.displayName,
    ],
  );

  return (
    <InboxProvider
      key={conv.id}
      conversationId={conv.id}
      seedMessages={conv.messages}
      threadIntroPeer={threadIntroPeer}
      peerUserId={conv.peerUserId ?? null}
      isGroup={!!conv.isGroup}
      remoteReactionPalette={conv.remoteReactionPalette ?? null}
    >
      <InboxScreenInner {...props} conversation={conv} />
    </InboxProvider>
  );
};

const InboxScreen: React.FC<Props> = p => <InboxGate {...p} />;

export default React.memo(InboxScreen);
