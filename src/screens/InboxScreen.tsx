import React, { useCallback } from 'react';
import { GiftedChat, Time } from 'react-native-gifted-chat';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackNavigatorParamList } from '../types/navigators';

import ChatMessageBox from '../components/message/ChatMessageBox';
import MessageHeader from '../components/message/MessageHeader';
import CustomInputToolbar from '../components/message/CustomInputToolbar';
import { useHelpAssistant } from '../hooks/useHelpAssistant';
import { colorss } from '../theme';

type Props = NativeStackScreenProps<RootStackNavigatorParamList, 'Inbox'>;

const InboxScreen: React.FC<Props> = ({ navigation }) => {
  const {
    messages,
    setText,
    initialText,
    setInitialText,
    user,
    insets,
    refreshTrigger,
    isRecording,
    inputAnimation,
    loadingMore,
    hasMore,
    width,
    onSend,
    handleVoiceRecordingStart,
    handleVoiceRecordingComplete,
    handleVoiceRecordingCancel,
    handleCameraPress,
    loadEarlier,
  } = useHelpAssistant();

  // Clear initialText after use
  React.useEffect(() => {
    if (initialText) {
      const t = setTimeout(() => setInitialText(''), 100);
      return () => clearTimeout(t);
    }
  }, [initialText, setInitialText]);

  // TODO: connect this to your FlatList/GiftedChat ref to scroll to original message
  const handlePressReplyPreview = useCallback((messageId: string | number) => {
    console.log('Scroll to message:', messageId);
    // e.g. flatListRef.current?.scrollToItem({ item: messages.find(m => m._id === messageId) });
  }, []);

  const renderInputToolbar = useCallback(
    (props: any) => (
      <CustomInputToolbar
        {...props}
        isRecording={isRecording}
        onRecordingComplete={handleVoiceRecordingComplete}
        onRecordingCancel={handleVoiceRecordingCancel}
        onVoiceRecordingStart={handleVoiceRecordingStart}
        inputAnimation={inputAnimation}
        handleCameraPress={handleCameraPress}
        insets={insets}
        width={width}
      />
    ),
    [
      isRecording,
      handleVoiceRecordingComplete,
      handleVoiceRecordingCancel,
      inputAnimation,
      insets,
      width,
      handleVoiceRecordingStart,
      handleCameraPress,
    ],
  );

  const renderTime = useCallback((props: any) => {
    const msg = props.currentMessage;
    if (!msg || msg._id === 'system-logo' || msg.system) return null;
    return (
      <Time
        {...props}
        timeTextStyle={{
          left: { color: '#667781' },
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
        onPressReplyPreview={handlePressReplyPreview}
      />
    ),
    [refreshTrigger, navigation, handlePressReplyPreview],
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colorss.primary }}>
      <MessageHeader
        onProfilePress={() => navigation.navigate('Profile', { userId: '1' })}
        onBackPress={() => navigation.navigate('BottomTab', { screen: 'Home' })}
        onAudioCall={() => navigation.navigate('AudioCall')}
        onVideoCall={() => console.log('hello world')}
      />

      <View style={{ flex: 1, backgroundColor: '#ECE5DD' }}>
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

export default React.memo(InboxScreen);
