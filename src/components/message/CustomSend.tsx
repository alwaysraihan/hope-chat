import React from 'react';
import { View, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Send } from 'react-native-gifted-chat';
import { IC_CAMERA, IC_MIC, IC_SEND } from '../../assets';

interface CustomSendProps {
  text: string;
  onCameraPress: () => void;
  onVoiceRecordingStart: () => void;
  [key: string]: any; // for generic props passed from GiftedChat
}

const CustomSend: React.FC<CustomSendProps> = ({
  text,
  onCameraPress,
  onVoiceRecordingStart,
  ...props
}) => {
  const hasText = (text?.trim()?.length ?? 0) > 0;

  return (
    <View style={styles.container}>
      {!hasText ? (
        <>
          <TouchableOpacity onPress={onCameraPress}>
            <Image source={IC_CAMERA} style={styles.iconCamera} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.micButton}
            onPress={onVoiceRecordingStart}
          >
            <Image source={IC_MIC} style={styles.iconMic} />
          </TouchableOpacity>
        </>
      ) : (
        <Send {...props} text={text} containerStyle={styles.sendContainer}>
          <View style={styles.sendButton}>
            <Image source={IC_SEND} style={styles.iconSend} />
          </View>
        </Send>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 14,
  },
  iconCamera: {
    height: 28,
    width: 28,
    resizeMode: 'contain',
  },
  micButton: {
    backgroundColor: '#F72585',
    height: 40,
    width: 40,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconMic: {
    tintColor: '#ffffff',
    height: 28,
    width: 28,
    resizeMode: 'contain',
  },
  sendContainer: {
    justifyContent: 'center',
  },
  sendButton: {
    backgroundColor: '#F72585',
    height: 40,
    width: 40,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconSend: {
    marginRight: -4,
    tintColor: '#ffffff',
    height: 24,
    width: 24,
    resizeMode: 'contain',
  },
});

export default React.memo(CustomSend);
