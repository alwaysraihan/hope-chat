import React, { useCallback, useState } from 'react';
import { GiftedChat, Time } from 'react-native-gifted-chat';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackNavigatorParamList } from '../types/navigators';

import ChatMessageBox from '../components/message/ChatMessageBox';
import MessageHeader from '../components/message/MessageHeader';
import CustomBubble from '../components/message/CustomBubble';
import CustomInputToolbar from '../components/message/CustomInputToolbar';
import MediaPreviewModal from '../components/message/ImagePreviewModal';
import { useHelpAssistant } from '../hooks/useHelpAssistant';
import { MediaType } from '../components/types/chat';
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

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'image' | 'video'>('image');

  // Clear initialText after use
  React.useEffect(() => {
    if (initialText) {
      const t = setTimeout(() => setInitialText(''), 100);
      return () => clearTimeout(t);
    }
  }, [initialText, setInitialText]);

  const handleMediaPress = useCallback(
    (url: string, type: 'image' | 'video') => {
      setPreviewUrl(url);
      setPreviewType(type);
    },
    [],
  );

  const renderBubble = useCallback(
    (props: any) => (
      <CustomBubble
        {...props}
        onImagePress={(media: any) => {
          const url = media?.url || media?.remoteUri || media?.localUri;
          const type: MediaType = media?.type === 'video' ? 'video' : 'image';
          if (url) handleMediaPress(url, type);
        }}
      />
    ),
    [handleMediaPress],
  );

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
        onMediaPress={handleMediaPress}
      />
    ),
    [refreshTrigger, navigation, handleMediaPress],
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
          renderBubble={renderBubble}
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

      <MediaPreviewModal
        visible={!!previewUrl}
        mediaUrl={previewUrl}
        mediaType={previewType}
        onClose={() => setPreviewUrl(null)}
      />
    </SafeAreaView>
  );
};

export default React.memo(InboxScreen);
