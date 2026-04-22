import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Text,
  Animated,
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
import { Composer, Send as MessageSend, InputToolbarProps, IMessage } from 'react-native-gifted-chat';
import FastImage from '@d11/react-native-fast-image';
import VoiceRecorder from './VoiceRecorder';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import { IC_PROFILE } from '../../assets';
import { resetReplayTo } from '../../redux/features/inbox/inboxSlice';
import { ExtendedMessage } from '../types/chat';
import { EdgeInsets } from 'react-native-safe-area-context';

// Theme
const colorss = {
  primary: '#F72585',
  background: '#FFFFFF',
  backgroundDeep: '#1a1a2e',
  textSecondary: '#9CA3AF',
  accent: '#F72585',
  replyAccent: '#00A884',
  surface: '#F0F2F5',
};

interface CustomInputToolbarProps extends InputToolbarProps<IMessage> {
  isRecording: boolean;
  onRecordingComplete: (path: string, duration: number) => void;
  onRecordingCancel: () => void;
  onVoiceRecordingStart: () => void;
  inputAnimation: Animated.Value;
  handleCameraPress: () => void;
  insets: EdgeInsets;
  width: number;
  text: string;
}

const CustomInputToolbar: React.FC<CustomInputToolbarProps> = props => {
  const [isExpanded, setIsExpanded] = useState(false);
  const replayTo = useAppSelector(state => state.inbox.replayTo) as ExtendedMessage | null;
  const dispatch = useAppDispatch();

  // Animations
  const expandAnim = useRef(new Animated.Value(0)).current;
  const replyHeight = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (props.text?.trim()) {
      setIsExpanded(true);
    }
  }, [props.text]);

  useEffect(() => {
    Animated.spring(expandAnim, {
      toValue: isExpanded ? 1 : 0,
      tension: 80,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [isExpanded, expandAnim]);

  useEffect(() => {
    Animated.spring(replyHeight, {
      toValue: replayTo ? 1 : 0,
      tension: 90,
      friction: 9,
      useNativeDriver: false,
    }).start();
  }, [replayTo, replyHeight]);

  const handleClearReply = useCallback(() => {
    dispatch(resetReplayTo());
  }, [dispatch]);

  if (props.isRecording) {
    return (
      <VoiceRecorder
        onCancel={props.onRecordingCancel}
        onRecordingComplete={props.onRecordingComplete}
      />
    );
  }

  // Reply preview content
  const isReplyImage = replayTo?.media?.type === 'image';
  const isReplyVideo = replayTo?.media?.type === 'video';
  const isReplyVoice = replayTo?.media?.type === 'voice';
  const replyThumbUri = isReplyImage || isReplyVideo
    ? replayTo?.media?.url ?? replayTo?.media?.remoteUri ?? replayTo?.media?.localUri
    : undefined;
  const getReplyPreviewText = (): string => {
    if (isReplyVoice) return '🎤 Voice message';
    if (isReplyVideo) return '🎬 Video';
    if (isReplyImage) return '📷 Photo';
    return replayTo?.text ?? '';
  };

  return (
    <View style={styles.container}>
      {/* Reply Preview Bar */}
      <Animated.View
        style={[
          styles.replyBar,
          {
            maxHeight: replyHeight.interpolate({ inputRange: [0, 1], outputRange: [0, 72] }),
            opacity: replyHeight,
            overflow: 'hidden',
          },
        ]}
      >
        {replayTo && (
          <View style={styles.replyInner}>
            <View style={styles.replyAccentLine} />
            <View style={styles.replyContent}>
              <Text style={styles.replyName} numberOfLines={1}>
                {replayTo.user?.name ?? 'User'}
              </Text>
              <Text style={styles.replyText} numberOfLines={1}>
                {getReplyPreviewText()}
              </Text>
            </View>
            {replyThumbUri ? (
              <FastImage
                source={{ uri: replyThumbUri }}
                style={styles.replyThumb}
                resizeMode={FastImage.resizeMode.cover}
              />
            ) : isReplyVoice ? (
              <Text style={{ fontSize: 22 }}>🎤</Text>
            ) : null}
            <Pressable
              onPress={handleClearReply}
              style={styles.replyClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={16} color={colorss.textSecondary} />
            </Pressable>
          </View>
        )}
      </Animated.View>

      {/* Input Row */}
      <View style={styles.inputRow}>
        {/* Left icons / collapse arrow */}
        {!isExpanded ? (
          <Animated.View
            style={[
              styles.leftIcons,
              { opacity: expandAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) },
            ]}
          >
            <IconButton icon={<Plus size={22} color={colorss.primary} />} />
            <TouchableOpacity onPress={props.handleCameraPress}>
              <IconButton icon={<Camera size={22} color={colorss.primary} />} />
            </TouchableOpacity>
            <IconButton icon={<ImageIcon size={22} color={colorss.primary} />} />
            <TouchableOpacity onPress={props.onVoiceRecordingStart}>
              <IconButton icon={<Mic size={22} color={colorss.primary} />} />
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <Pressable onPress={() => setIsExpanded(false)} style={styles.collapseBtn}>
            <ArrowRight size={22} color={colorss.primary} />
          </Pressable>
        )}

        {/* Text Input */}
        <View style={styles.inputWrapper}>
          <Composer
            {...props}
            text={props.text}
            textInputProps={{
              style: styles.input,
              placeholderTextColor: colorss.textSecondary,
              multiline: true,
              numberOfLines: 3,
              placeholder: 'Type here…',
              onChangeText: props.textInputProps?.onChangeText,
            }}
          />
          <TouchableOpacity style={styles.emojiBtn}>
            <Smile size={20} color={colorss.primary} />
          </TouchableOpacity>
        </View>

        {/* Send / Like */}
        {props.text?.trim() ? (
          <MessageSend {...props} style={styles.actionBtn}>
            <Send size={22} color={colorss.primary} />
          </MessageSend>
        ) : (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={props.onVoiceRecordingStart}
          >
            <Mic size={22} color={colorss.primary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const IconButton: React.FC<{ icon: React.ReactNode }> = ({ icon }) => (
  <TouchableOpacity style={styles.iconBtn}>{icon}</TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: colorss.background,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E9EDEF',
  },

  // Reply bar
  replyBar: {
    marginBottom: 4,
  },
  replyInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colorss.surface,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 8,
  },
  replyAccentLine: {
    width: 3,
    alignSelf: 'stretch',
    backgroundColor: colorss.replyAccent,
    borderRadius: 2,
    minHeight: 28,
  },
  replyContent: {
    flex: 1,
    gap: 2,
  },
  replyName: {
    color: colorss.replyAccent,
    fontWeight: '700',
    fontSize: 12,
  },
  replyText: {
    color: '#667781',
    fontSize: 12,
  },
  replyThumb: {
    width: 38,
    height: 38,
    borderRadius: 6,
  },
  replyClose: {
    padding: 2,
  },

  // Input row
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  leftIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    marginRight: 6,
    padding: 4,
  },
  collapseBtn: {
    padding: 4,
    marginRight: 4,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colorss.surface,
    borderRadius: 24,
    paddingHorizontal: 14,
    minHeight: 42,
    maxHeight: 100,
  },
  input: {
    flex: 1,
    color: '#111B21',
    fontSize: 15,
    paddingVertical: 6,
  },
  emojiBtn: {
    marginLeft: 8,
    padding: 2,
  },
  actionBtn: {
    padding: 6,
  },
});

export default React.memo(CustomInputToolbar);
