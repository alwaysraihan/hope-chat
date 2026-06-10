import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Text,
  Animated,
  ScrollView,
} from 'react-native';
import {
  Camera,
  Image,
  Mic,
  Smile,
  Send,
  ArrowRight,
  X,
  ThumbsUp,
} from 'lucide-react-native';
import {
  Composer,
  Send as GiftedSend,
  InputToolbarProps,
  IMessage,
} from 'react-native-gifted-chat';
import FastImage from '@d11/react-native-fast-image';

import VoiceRecorder from './VoiceRecorder';
import { useInbox } from '../../context/InboxContext';
import { colorss } from '../../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useKeyboardVisible from '../../hooks/useKeyboardVisible';

const CustomInputToolbar: React.FC<InputToolbarProps<IMessage>> = props => {
  const {
    isRecording,
    replyTo,
    handleCameraPress,
    handleGalleryPress,
    handleVoiceRecordingStart,
    handleVoiceRecordingComplete,
    handleVoiceRecordingCancel,
    clearReply,
  } = useInbox();

  const [isExpanded, setIsExpanded] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const { bottom } = useSafeAreaInsets();
  const isKeyboardVisible = useKeyboardVisible();

  const COMMON_EMOJIS = [
    '😀',
    '😂',
    '😍',
    '😊',
    '🥰',
    '😎',
    '😭',
    '😅',
    '🤣',
    '😢',
    '❤️',
    '🧡',
    '💛',
    '💚',
    '💙',
    '💜',
    '🖤',
    '🤍',
    '💔',
    '💕',
    '👍',
    '👎',
    '👋',
    '🙌',
    '👏',
    '🤝',
    '🙏',
    '💪',
    '✌️',
    '🤞',
    '🎉',
    '🎊',
    '🔥',
    '⭐',
    '✨',
    '💫',
    '🌟',
    '🎵',
    '🎶',
    '💯',
    '😴',
    '🤔',
    '😤',
    '😱',
    '🤯',
    '🥳',
    '🤩',
    '😏',
    '😒',
    '🙄',
    '🐶',
    '🐱',
    '🦁',
    '🐸',
    '🐧',
    '🦋',
    '🌹',
    '🌺',
    '🍕',
    '🍔',
  ];

  const appendEmoji = (emoji: string) => {
    const current = props.text ?? '';
    props.textInputProps?.onChangeText?.(current + emoji);
  };
  const expandAnim = useRef(new Animated.Value(0)).current;
  const replyHeight = useRef(new Animated.Value(0)).current;

  // Expand when the user starts typing
  useEffect(() => {
    if (props.text?.trim()) setIsExpanded(true);
  }, [props.text]);

  // Animate expand / collapse
  useEffect(() => {
    Animated.spring(expandAnim, {
      toValue: isExpanded ? 1 : 0,
      tension: 80,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [isExpanded, expandAnim]);

  // Animate reply bar height
  useEffect(() => {
    Animated.spring(replyHeight, {
      toValue: replyTo ? 1 : 0,
      tension: 90,
      friction: 9,
      useNativeDriver: false,
    }).start();
  }, [replyTo, replyHeight]);

  // ── Voice recording UI
  if (isRecording) {
    return (
      <VoiceRecorder
        onCancel={handleVoiceRecordingCancel}
        onRecordingComplete={handleVoiceRecordingComplete}
      />
    );
  }

  // ── Reply preview helpers
  const isReplyImage = replyTo?.media?.type === 'image';
  const isReplyVideo = replyTo?.media?.type === 'video';
  const isReplyVoice = replyTo?.media?.type === 'voice';
  const replyThumbUri =
    isReplyImage || isReplyVideo
      ? replyTo?.media?.url ??
        replyTo?.media?.remoteUri ??
        replyTo?.media?.localUri
      : undefined;

  const getReplyPreviewText = (): string => {
    if (isReplyVoice) return '🎤 Voice message';
    if (isReplyVideo) return '🎬 Video';
    if (isReplyImage) return '📷 Photo';
    return replyTo?.text ?? '';
  };

  const hasText = Boolean(props.text?.trim());
  const bottomPadding = isKeyboardVisible ? 10 : bottom;
  return (
    <View
      style={[styles.container, { paddingBottom: Math.max(10, bottomPadding) }]}
    >
      {/* Reply Preview Bar */}
      <Animated.View
        style={[
          styles.replyBar,
          {
            maxHeight: replyHeight.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 72],
            }),
            opacity: replyHeight,
            overflow: 'hidden',
          },
        ]}
      >
        {replyTo && (
          <View style={styles.replyInner}>
            <View style={styles.replyAccentLine} />
            <View style={styles.replyContent}>
              <Text style={styles.replyName} numberOfLines={1}>
                {replyTo.user?.name ?? 'User'}
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
              <Text style={styles.replyVoiceEmoji}>🎤</Text>
            ) : null}
            <Pressable
              onPress={clearReply}
              style={styles.replyClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={16} color={colorss.placeholder} />
            </Pressable>
          </View>
        )}
      </Animated.View>

      {/* Emoji Picker Panel */}
      {showEmojiPicker && (
        <View style={styles.emojiPanel}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.emojiScroll}
          >
            {COMMON_EMOJIS.map(emoji => (
              <TouchableOpacity
                key={emoji}
                style={styles.emojiItem}
                onPress={() => appendEmoji(emoji)}
              >
                <Text style={styles.emojiChar}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Input Row */}
      <View style={styles.inputRow}>
        {/* Left icons or collapse arrow */}
        {!isExpanded ? (
          <Animated.View
            style={[
              styles.leftIcons,
              {
                opacity: expandAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 0],
                }),
              },
            ]}
          >
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={handleCameraPress}
            >
              <Camera size={22} color={colorss.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={handleGalleryPress}
            >
              <Image size={22} color={colorss.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={handleVoiceRecordingStart}
            >
              <Mic size={22} color={colorss.primary} />
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <Pressable
            onPress={() => setIsExpanded(false)}
            style={styles.collapseBtn}
          >
            <ArrowRight size={22} color={colorss.primary} />
          </Pressable>
        )}

        {/* Text Composer */}
        <View style={styles.inputWrapper}>
          <Composer
            {...props}
            text={props.text}
            textInputProps={{
              style: styles.input,
              placeholderTextColor: colorss.placeholder,
              multiline: true,
              numberOfLines: 3,
              placeholder: 'Type here…',
              onChangeText: props?.textInputProps?.onChangeText,
            }}
          />
          <TouchableOpacity
            style={styles.emojiBtn}
            onPress={() => setShowEmojiPicker(v => !v)}
          >
            <Smile
              size={20}
              color={showEmojiPicker ? colorss.primary : colorss.placeholder}
            />
          </TouchableOpacity>
        </View>

        {/* Send or Mic */}
        {hasText ? (
          <GiftedSend {...props} style={styles.actionBtn}>
            <Send size={22} color={colorss.primary} />
          </GiftedSend>
        ) : (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => props?.onSend?.({ text: '👍' } as any)}
          >
            <ThumbsUp size={22} color={colorss.primary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default React.memo(CustomInputToolbar);

// ─── Styles

const styles = StyleSheet.create({
  container: {
    backgroundColor: colorss.white,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colorss.border,
  },
  replyBar: { marginBottom: 4 },
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
    backgroundColor: colorss.success,
    borderRadius: 2,
    minHeight: 28,
  },
  replyContent: { flex: 1, gap: 2 },
  replyName: { color: colorss.success, fontWeight: '700', fontSize: 12 },
  replyText: { color: colorss.textSecondary, fontSize: 12 },
  replyThumb: { width: 38, height: 38, borderRadius: 6 },
  replyVoiceEmoji: { fontSize: 22 },
  replyClose: { padding: 2 },

  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  leftIcons: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { marginRight: 4, padding: 5 },
  collapseBtn: { padding: 5, marginRight: 4 },
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
    color: colorss.textPrimary,
    fontSize: 15,
    paddingVertical: 6,
  },
  emojiBtn: { marginLeft: 8, padding: 2 },
  actionBtn: { padding: 6 },
  emojiPanel: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colorss.border,
    paddingVertical: 6,
  },
  emojiScroll: {
    paddingHorizontal: 4,
    gap: 2,
  },
  emojiItem: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  emojiChar: {
    fontSize: 26,
  },
});
