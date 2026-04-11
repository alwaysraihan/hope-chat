import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import {
  Plus,
  Camera,
  Image as ImageIcon,
  Mic,
  Smile,
  ThumbsUp,
  Send,
} from 'lucide-react-native';
import { Composer, Send as MessageSend } from 'react-native-gifted-chat';
import { colorss } from '../../theme';
import VoiceRecorder from './VoiceRecorder';

const CustomInputToolbar: React.FC<any> = props => {
  if (props.isRecording) {
    return (
      <VoiceRecorder
        onCancel={props?.onRecordingCancel}
        onRecordingComplete={props?.onRecordingComplete}
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* Left Icons */}
      <View style={styles.leftIcons}>
        <IconButton icon={<Plus size={22} color={colorss.primary} />} />
        <TouchableOpacity onPress={props?.handleCameraPress}>
          <IconButton icon={<Camera size={22} color={colorss.primary} />} />
        </TouchableOpacity>
        <IconButton icon={<ImageIcon size={22} color={colorss.primary} />} />
        <TouchableOpacity onPress={props?.onVoiceRecordingStart}>
          <IconButton icon={<Mic size={22} color={colorss.primary} />} />
        </TouchableOpacity>
      </View>

      {/* Input */}
      <View style={styles.inputWrapper}>
        <Composer
          textInputProps={{
            placeholder: 'Message',
            style: styles.input,
            placeholderTextColor: colorss.textSecondary,
            multiline: true,
            numberOfLines: 3,
          }}
          {...props}
        />

        <TouchableOpacity style={styles.emojiBtn}>
          <Smile size={20} color={colorss.primary} />
        </TouchableOpacity>
      </View>

      {props?.text.trim() ? (
        <MessageSend {...props} style={styles.rightBtn}>
          <Send size={22} color={colorss.primary} />
        </MessageSend>
      ) : (
        <TouchableOpacity style={styles.rightBtn}>
          <ThumbsUp size={24} color={colorss.primary} />
        </TouchableOpacity>
      )}
    </View>
  );
};

export default React.memo(CustomInputToolbar);
const IconButton = ({ icon }) => (
  <TouchableOpacity style={styles.iconBtn}>{icon}</TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colorss.background,
  },

  leftIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  iconBtn: {
    marginRight: 10,
  },

  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colorss.backgroundDeep,
    borderRadius: 25,
    paddingHorizontal: 12,
    height: 40,
  },

  input: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
  },

  emojiBtn: {
    marginLeft: 8,
  },

  rightBtn: {
    marginLeft: 10,
  },
});
