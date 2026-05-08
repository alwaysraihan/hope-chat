import React, { useCallback, useEffect } from 'react';
import { View } from 'react-native';
import { GiftedChat, Time } from 'react-native-gifted-chat';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { InboxProvider, useInbox } from '../context/InboxContext';
import ChatMessageBox from '../components/message/ChatMessageBox';
import MessageHeader from '../components/message/MessageHeader';
import CustomInputToolbar from '../components/message/CustomInputToolbar';
import { colorss } from '../theme';
import { RootStackNavigatorParamList } from '../types/navigators';

type Props = NativeStackScreenProps<RootStackNavigatorParamList, 'Inbox'>;

// ─── Inner screen (has access to InboxContext) ────────────────────────────────

const InboxScreenInner: React.FC<Props> = ({ navigation }) => {
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
  // Clear initialText after GiftedChat consumes it
  useEffect(() => {
    if (!initialText) return;
    const t = setTimeout(() => setInitialText(''), 100);
    return () => clearTimeout(t);
  }, [initialText, setInitialText]);

  // ── Renderers ──────────────────────────────────────────────────────────────
  // No prop drilling needed — CustomInputToolbar and ChatMessageBox
  // call useInbox() directly to access what they need.

  const renderInputToolbar = useCallback(
    (props: any) => <CustomInputToolbar {...props} />,
    [],
  );

  const renderTime = useCallback((props: any) => {
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
    (props: any) => (
      <ChatMessageBox
        {...props}
        refreshTrigger={refreshTrigger}
        onPressReactions={() => navigation.navigate('Reactions')}
      />
    ),
    [refreshTrigger, navigation],
  );

  //  Render

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colorss.primary }}
      edges={['top', 'left', 'right']}
    >
      <MessageHeader
        onProfilePress={() => navigation.navigate('Profile', { userId: '1' })}
        onBackPress={() => navigation.navigate('BottomTab', { screen: 'Home' })}
        onAudioCall={() => navigation.navigate('AudioCall')}
        onVideoCall={() => navigation.navigate('VideoCall')}
      />

      <View style={{ flex: 1, backgroundColor: colorss.background }}>
        <GiftedChat
          placeholder="Type here…"
          messages={messages as any[]}
          {...(initialText ? { text: initialText } : {})}
          onSend={(msgs: any) => onSend(msgs)}
          // @ts-ignore
          onInputTextChanged={setText}
          user={{ _id: user?._id || '1' }}
          renderTime={renderTime}
          renderAvatar={null}
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

// ─── Outer screen — mounts the provider, then renders the inner screen ────────

const InboxScreen: React.FC<Props> = props => (
  <InboxProvider>
    <InboxScreenInner {...props} />
  </InboxProvider>
);

export default React.memo(InboxScreen);
