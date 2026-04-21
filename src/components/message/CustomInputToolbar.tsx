import React, { useEffect, useState } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Text,
  Image,
} from 'react-native';
import {
  Plus,
  Camera,
  Image as ImageIcon,
  Mic,
  Smile,
  ThumbsUp,
  Send,
  ArrowRight,
  X,
} from 'lucide-react-native';
import { Composer, Send as MessageSend } from 'react-native-gifted-chat';
import { colorss } from '../../theme';
import VoiceRecorder from './VoiceRecorder';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import { IC_PROFILE } from '../../assets';
import { resetReplayTo } from '../../redux/features/inbox/inboxSlice';

const CustomInputToolbar: React.FC<any> = props => {
  const [isExpanded, setIsExpanded] = useState(false);
  const replayTo = useAppSelector(state => state.inbox.replayTo);
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (props?.text.trim()) {
      setIsExpanded(true);
    }
  }, [props?.text]);

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
      {replayTo && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 10,
          }}
        >
          <View style={{ width: '75%' }}>
            <Text style={{ fontWeight: '500' }}>
              Replay to {replayTo.user.name}
            </Text>
            <Text numberOfLines={1}>{replayTo.text}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Image
              source={IC_PROFILE}
              style={{ width: 30, height: 30, borderRadius: 4 }}
            />
            <Pressable
              onPress={() => dispatch(resetReplayTo())}
              style={{
                padding: 4,
                backgroundColor: colorss.backgroundDeep,
                borderRadius: 99,
              }}
            >
              <X size={22} color={colorss.primary} />
            </Pressable>
          </View>
        </View>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {!isExpanded ? (
          <View style={styles.leftIcons}>
            <IconButton icon={<Plus size={22} color={colorss.primary} />} />
            <TouchableOpacity onPress={props?.handleCameraPress}>
              <IconButton icon={<Camera size={22} color={colorss.primary} />} />
            </TouchableOpacity>
            <IconButton
              icon={<ImageIcon size={22} color={colorss.primary} />}
            />
            <TouchableOpacity onPress={props?.onVoiceRecordingStart}>
              <IconButton icon={<Mic size={22} color={colorss.primary} />} />
            </TouchableOpacity>
          </View>
        ) : (
          <Pressable onPress={() => setIsExpanded(false)}>
            <ArrowRight size={22} color={colorss.primary} />
          </Pressable>
        )}

        {/* Input */}
        <View style={styles.inputWrapper}>
          <Composer
            {...props}
            text={props.text}
            textInputProps={{
              style: styles.input,
              placeholderTextColor: colorss.textSecondary,
              multiline: true,
              numberOfLines: 3,
              placeholder: 'Type here...',
              onChangeText: props.textInputProps?.onChangeText,
            }}
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
    </View>
  );
};

export default React.memo(CustomInputToolbar);
const IconButton = ({ icon }) => (
  <TouchableOpacity style={styles.iconBtn}>{icon}</TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
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
    minHeight: 40,
    maxHeight: 100,
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
