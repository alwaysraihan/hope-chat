import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Text,
  Animated,
  ScrollView,
  TextInput,
  TextInputProps,
} from 'react-native';
import {
  Camera,
  Image,
  Mic,
  ShoppingBag,
  Smile,
  Send,
  ArrowRight,
  X,
  ThumbsUp,
} from 'lucide-react-native';
import {
  Send as GiftedSend,
  InputToolbarProps,
  IMessage,
} from 'react-native-gifted-chat';
import FastImage from '@d11/react-native-fast-image';

import VoiceRecorder from './VoiceRecorder';
import { useInbox } from '../../context/InboxContext';
import { ExtendedMessage } from '../types/chat';
import { colorss } from '../../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useKeyboardVisible from '../../hooks/useKeyboardVisible';
import { useAppTheme } from '../../context/ThemeContext';

// gifted-chat's bundled InputToolbar wires up more props than its own
// `InputToolbarProps` type declares (see GiftedChat/index.tsx), so we
// extend it with the fields we actually rely on here.
type CustomInputToolbarProps = InputToolbarProps<IMessage> & {
  text?: string;
  textInputProps?: TextInputProps;
  onSend?: (
    messages: Partial<IMessage> | Partial<IMessage>[],
    shouldResetInputToolbar?: boolean,
  ) => void;
};

const MIN_COMPOSER_HEIGHT = 36;
const MAX_COMPOSER_HEIGHT = 132;

const COMMON_EMOJIS = [
  '😀', '😂', '😍', '😊', '🥰', '😎', '😭', '😅', '🤣', '😢',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💔', '💕',
  '👍', '👎', '👋', '🙌', '👏', '🤝', '🙏', '💪', '✌️', '🤞',
  '🎉', '🎊', '🔥', '⭐', '✨', '💫', '🌟', '🎵', '🎶', '💯',
  '😴', '🤔', '😤', '😱', '🤯', '🥳', '🤩', '😏', '😒', '🙄',
  '🐶', '🐱', '🦁', '🐸', '🐧', '🦋', '🌹', '🌺', '🍕', '🍔',
];

// Never surface raw ciphertext in the reply preview — if it wasn't
// decryptable at capture time (key not resolved yet), show a neutral
// placeholder instead.
const isCiphertext = (text: string) =>
  text.startsWith('HC1:') || text.startsWith('HCG1:');

const getReplyPreviewText = (replyTo: ExtendedMessage): string => {
  if (replyTo.media?.type === 'voice') return '🎤 Voice message';
  if (replyTo.media?.type === 'video') return '🎬 Video';
  if (replyTo.media?.type === 'image') return '📷 Photo';
  const text = replyTo.text ?? '';
  return isCiphertext(text) ? '🔒 Encrypted message' : text;
};

const ReplyPreviewBar: React.FC<{
  replyTo: ExtendedMessage | null;
  animatedHeight: Animated.Value;
  onClear: () => void;
}> = ({ replyTo, animatedHeight, onClear }) => {
  const isImage = replyTo?.media?.type === 'image';
  const isVideo = replyTo?.media?.type === 'video';
  const isVoice = replyTo?.media?.type === 'voice';
  const thumbUri =
    isImage || isVideo
      ? replyTo?.media?.url ?? replyTo?.media?.remoteUri ?? replyTo?.media?.localUri
      : undefined;

  return (
    <Animated.View
      style={[
        styles.replyBar,
        {
          maxHeight: animatedHeight.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 72],
          }),
          opacity: animatedHeight,
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
              {getReplyPreviewText(replyTo)}
            </Text>
          </View>
          {thumbUri ? (
            <FastImage
              source={{ uri: thumbUri }}
              style={styles.replyThumb}
              resizeMode={FastImage.resizeMode.cover}
            />
          ) : isVoice ? (
            <Text style={styles.replyVoiceEmoji}>🎤</Text>
          ) : null}
          <Pressable
            onPress={onClear}
            style={styles.replyClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <X size={16} color={colorss.placeholder} />
          </Pressable>
        </View>
      )}
    </Animated.View>
  );
};

const EmojiPicker: React.FC<{ onSelect: (emoji: string) => void }> = ({
  onSelect,
}) => (
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
          onPress={() => onSelect(emoji)}
        >
          <Text style={styles.emojiChar}>{emoji}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  </View>
);

const ComposerActions: React.FC<{
  visible: boolean;
  opacity: Animated.AnimatedInterpolation<number>;
  onCameraPress: () => void;
  onGalleryPress: () => void;
  onVoicePress: () => void;
  onSellerPress: () => void;
}> = ({
  visible,
  opacity,
  onCameraPress,
  onGalleryPress,
  onVoicePress,
  onSellerPress,
}) => {
  if (!visible) return null;
  return (
    <Animated.View style={[styles.leftIcons, { opacity }]}>
      <TouchableOpacity style={styles.iconBtn} onPress={onCameraPress}>
        <Camera size={22} color={colorss.primary} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.iconBtn} onPress={onGalleryPress}>
        <Image size={22} color={colorss.primary} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.iconBtn} onPress={onVoicePress}>
        <Mic size={22} color={colorss.primary} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.iconBtn} onPress={onSellerPress}>
        <ShoppingBag size={22} color={colorss.primary} />
      </TouchableOpacity>
    </Animated.View>
  );
};

const CustomInputToolbar: React.FC<CustomInputToolbarProps> = props => {
  const {
    isRecording,
    replyTo,
    text: contextText,
    handleCameraPress,
    handleGalleryPress,
    handleVoiceRecordingStart,
    handleVoiceRecordingComplete,
    handleVoiceRecordingCancel,
    clearReply,
    openSellerSheet,
  } = useInbox();
  const { isDark, colors } = useAppTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [composerHeight, setComposerHeight] = useState(MIN_COMPOSER_HEIGHT);
  const { bottom } = useSafeAreaInsets();
  const isKeyboardVisible = useKeyboardVisible();

  const expandAnim = useRef(new Animated.Value(0)).current;
  const replyHeight = useRef(new Animated.Value(0)).current;

  const appendEmoji = (emoji: string) => {
    const current = props.text ?? '';
    props.textInputProps?.onChangeText?.(current + emoji);
  };

  // Expand when the user starts typing
  useEffect(() => {
    if (props.text?.trim()) setIsExpanded(true);
  }, [props.text]);

  // Collapse the composer back down once the text is cleared (e.g. after send)
  useEffect(() => {
    if (!props.text) setComposerHeight(MIN_COMPOSER_HEIGHT);
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

  // props.text comes from GiftedChat's internal composer state. It can be
  // undefined depending on how the toolbar is rendered, and when it was the ONLY
  // source the Send button silently turned back into the thumbs-up while the
  // user had text on screen. The context value is updated by
  // onInputTextChanged, so it is a reliable second source.
  const hasText = Boolean((props.text ?? contextText ?? '').trim());
  const bottomPadding = isKeyboardVisible ? 10 : bottom;

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: Math.max(10, bottomPadding),
          backgroundColor: isDark ? colors.backgroundDeep : colors.white,
        },
      ]}
    >
      <ReplyPreviewBar
        replyTo={replyTo}
        animatedHeight={replyHeight}
        onClear={clearReply}
      />

      {showEmojiPicker && <EmojiPicker onSelect={appendEmoji} />}

      {/* Input Row */}
      <View style={styles.inputRow}>
        {!isExpanded ? (
          <ComposerActions
            visible
            opacity={expandAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 0],
            })}
            onCameraPress={handleCameraPress}
            onGalleryPress={handleGalleryPress}
            onVoicePress={handleVoiceRecordingStart}
            onSellerPress={openSellerSheet}
          />
        ) : (
          <Pressable
            onPress={() => setIsExpanded(false)}
            style={styles.collapseBtn}
          >
            <ArrowRight size={22} color={colorss.primary} />
          </Pressable>
        )}

        {/* Text Composer */}
        <View
          style={[
            styles.inputWrapper,
            {
              backgroundColor: colors.surface,
              minHeight: composerHeight + 16,
              alignItems:'center'
            },
          ]}
        >
          <TextInput
            {...props.textInputProps}
            value={props.text}
            onChangeText={props.textInputProps?.onChangeText}
            style={[
              styles.input,
              styles.composerInput,
              { color: colors.textPrimary },
            ]}
            placeholderTextColor={colorss.placeholder}
            multiline
            placeholder="Type here…"
            onContentSizeChange={e => {
              const contentHeight =
                e?.nativeEvent?.contentSize?.height ?? MIN_COMPOSER_HEIGHT;
              setComposerHeight(
                Math.max(
                  MIN_COMPOSER_HEIGHT,
                  Math.min(MAX_COMPOSER_HEIGHT, contentHeight),
                ),
              );
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
          <GiftedSend {...props} containerStyle={styles.actionBtn}>
            <Send size={22} color={colorss.primary} />
          </GiftedSend>
        ) : (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => props.onSend?.({ text: '👍' })}
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
  },
  replyBar: { marginBottom: 4, overflow: 'hidden' },
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
    alignItems: 'flex-end',
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 6,
    minHeight: 52,
  },
  composerInput: {
    minHeight: 40,
    maxHeight: 140,
    paddingTop: 10,
    paddingBottom: 10,
  },
  input: {
    flex: 1,
    color: colorss.textPrimary,
    fontSize: 15,
    lineHeight: 20,
    paddingVertical: 8,
    minHeight: 36,
    // ~5 lines before it scrolls — matches maxComposerHeight in InboxScreen
    // and keeps at least 3 lines comfortably visible for a long message,
    // WhatsApp-style, instead of clipping after ~1.5 lines.
    maxHeight: 132,
    textAlignVertical: 'top',
  },
  emojiBtn: { marginLeft: 8, padding: 2 },
  actionBtn: { padding: 6, justifyContent: 'center' },
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
