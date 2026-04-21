import React, { useCallback } from 'react';
import { GiftedChat, Time } from 'react-native-gifted-chat';

import ChatMessageBox from '../components/message/ChatMessageBox';
import MessageHeader from '../components/message/MessageHeader';

import { useHelpAssistant } from '../hooks/useHelpAssistant';

import CustomBubble from '../components/message/CustomBubble';
import CustomInputToolbar from '../components/message/CustomInputToolbar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackNavigatorParamList } from '../types/navigators';

type Props = NativeStackScreenProps<RootStackNavigatorParamList, 'Inbox'>;

const HelpAssistantScreen: React.FC<Props> = ({ navigation }) => {
  //   const { t } = useTranslation();
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
    setModalVisible,
    setModalImageUrl,
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

  // Clear initialText after it's been used
  React.useEffect(() => {
    if (initialText) {
      const timer = setTimeout(() => {
        setInitialText('');
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [initialText, setInitialText]);

  const handleImagePress = useCallback(
    (media: any) => {
      const imageUrl = media?.url || media?.remoteUri || media?.localUri;
      if (imageUrl) {
        setModalImageUrl(imageUrl);
        setModalVisible(true);
      }
    },
    [setModalImageUrl, setModalVisible],
  );

  // Render Functions wrapped in useCallback to prevent re-renders
  const renderBubble = useCallback(
    (props: any) => <CustomBubble {...props} onImagePress={handleImagePress} />,
    [handleImagePress],
  );

  const handleTextChange = useCallback(
    (newText: string) => {
      setText(newText);
    },
    [setText],
  );

  const renderInputToolbar = useCallback(
    (props: any) => {
      return (
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
      );
    },
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
    if (
      props.currentMessage &&
      (props.currentMessage._id === 'system-logo' ||
        props.currentMessage.system)
    ) {
      return null;
    }
    return (
      <Time
        {...props}
        timeTextStyle={{
          left: { color: 'black' },
          right: { color: 'white' },
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

  const renderLoadEarlier = useCallback(() => <></>, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F72585' }}>
      <MessageHeader
        onProfilePress={() =>
          navigation.navigate('Profile', {
            userId: '1',
          })
        }
        onBackPress={() =>
          navigation.navigate('BottomTab', {
            screen: 'Home',
          })
        }
        onAudioCall={() => navigation.navigate('AudioCall')}
      />
      <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
        <GiftedChat
          placeholder={'Type here...'}
          messages={messages as any[]}
          {...(initialText ? { text: initialText } : {})}
          onSend={(messages: any) => onSend(messages)}
          // @ts-ignore
          onInputTextChanged={handleTextChange}
          user={{
            _id: user?._id || '1',
          }}
          renderTime={renderTime}
          renderAvatar={null}
          maxComposerHeight={100}
          alwaysShowSend={true}
          // Custom Renders
          renderBubble={renderBubble}
          renderInputToolbar={renderInputToolbar}
          renderMessage={renderMessage}
          loadEarlier={hasMore}
          infiniteScroll={true}
          renderLoadEarlier={renderLoadEarlier}
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

export default React.memo(HelpAssistantScreen);
