import React, { useCallback, useEffect } from 'react';
import { View, Text } from 'react-native';
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

type Props = NativeStackScreenProps<RootStackNavigatorParamList, 'Inbox'>;

const InboxScreenInner: React.FC<
  Props & { conversation: ConversationSummary }
> = ({ navigation, route, conversation }) => {
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

  const audioRoom =
    route.params.liveKitRoom ?? `call_${conversation.id}`;
  const peerName =
    route.params.displayName ?? conversation.name;

  const renderInputToolbar = useCallback(
    (p: unknown) => <CustomInputToolbar {...(p as object)} />,
    [],
  );

  const renderTime = useCallback((props: TimeProps<IMessage>) => {
    const msg = props.currentMessage;
    if (!msg || msg._id === 'system-logo' || msg.system) return null;
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
    (props: MessageProps<IMessage>) => (
      <ChatMessageBox
        {...props}
        refreshTrigger={refreshTrigger}
        onPressReactions={() => navigation.navigate('Reactions')}
      />
    ),
    [refreshTrigger, navigation],
  );

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colorss.primary }}
      edges={['top', 'left', 'right']}
    >
      <MessageHeader
        name={peerName}
        avatarUri={route.params.avatarUrl ?? conversation.avatarUrl}
        onProfilePress={() =>
          navigation.navigate('Profile', {
            userId: conversation.id,
          })
        }
        onBackPress={() => navigation.navigate('BottomTab', { screen: 'Home' })}
        onAudioCall={() =>
          navigation.navigate('AudioCall', {
            displayName: peerName,
            liveKitRoom: audioRoom,
          })
        }
        onVideoCall={() =>
          navigation.navigate('VideoCall', {
            displayName: peerName,
            liveKitRoom: audioRoom,
          })
        }
      />

      <View style={{ flex: 1, backgroundColor: colorss.background }}>
        <GiftedChat
          placeholder="Type here…"
          messages={messages as unknown as IMessage[]}
          {...(initialText ? { text: initialText } : {})}
          onSend={(msgs: IMessage[]) =>
            onSend(msgs as ExtendedMessage[])
          }
          onInputTextChanged={setText}
          user={{
            _id: user?._id || '1',
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
      </View>
    </SafeAreaView>
  );
};

const InboxGate: React.FC<Props> = props => {
  const { conversations } = useChats();
  const id = props.route.params.conversationId;
  const conv = conversations.find(c => c.id === id);

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

  return (
    <InboxProvider
      key={conv.id}
      conversationId={conv.id}
      seedMessages={conv.messages}
    >
      <InboxScreenInner {...props} conversation={conv} />
    </InboxProvider>
  );
};

const InboxScreen: React.FC<Props> = p => <InboxGate {...p} />;

export default React.memo(InboxScreen);
