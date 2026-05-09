import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import FastImage from '@d11/react-native-fast-image';
import { X } from 'lucide-react-native';

import { ExtendedMessage } from '../types/chat';
import { colorss } from '../../theme';

//  Types 

type ReplyMessageBarProps = {
  clearReply: () => void;
  message: ExtendedMessage | null;
  onReplyPress?: (messageId: string | number) => void;
};

//  Component 

const ReplyMessageBar: React.FC<ReplyMessageBarProps> = ({
  clearReply,
  message,
  onReplyPress,
}) => {
  if (!message) return null;

  const isVoice = message.media?.type === 'voice';
  const isImage = message.media?.type === 'image';
  const isVideo = message.media?.type === 'video';

  const previewUri =
    isImage || isVideo
      ? message.media?.url ?? message.media?.remoteUri ?? message.media?.localUri
      : null;

  const getPreviewText = (): string => {
    if (isVoice) return '🎤 Voice message';
    if (isVideo) return '🎬 Video';
    if (isImage) return '📷 Photo';
    const t = message.text ?? '';
    return t.length > 80 ? t.substring(0, 80) + '…' : t;
  };

  return (
    <Animated.View
      style={styles.container}
      entering={FadeInDown.duration(200).springify()}
      exiting={FadeOutDown.duration(150)}
    >
      <View style={styles.accentBar} />

      <TouchableOpacity
        style={styles.content}
        onPress={() => onReplyPress?.(message._id)}
        activeOpacity={0.7}
      >
        <Text style={styles.senderName} numberOfLines={1}>
          {message.user?.name ?? 'Unknown'}
        </Text>
        <Text style={styles.previewText} numberOfLines={2}>
          {getPreviewText()}
        </Text>
      </TouchableOpacity>

      {/* Media thumbnail */}
      {(isImage || isVideo) && previewUri && (
        <View style={styles.thumbnailWrapper}>
          <FastImage
            source={{ uri: previewUri }}
            style={styles.thumbnail}
            resizeMode={FastImage.resizeMode.cover}
          />
          {isVideo && (
            <View style={styles.playOverlay}>
              <Text style={styles.playIcon}>▶</Text>
            </View>
          )}
        </View>
      )}

      {isVoice && (
        <View style={styles.voiceIcon}>
          <Text style={{ fontSize: 20 }}>🎤</Text>
        </View>
      )}

      <TouchableOpacity
        onPress={clearReply}
        style={styles.closeBtn}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <X size={18} color={colorss.textSecondary} />
      </TouchableOpacity>
    </Animated.View>
  );
};

export default React.memo(ReplyMessageBar);

//  Styles 

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colorss.surface,
    borderTopWidth: 1,
    borderTopColor: colorss.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 58,
    gap: 10,
  },
  accentBar: {
    width: 3,
    alignSelf: 'stretch',
    backgroundColor: colorss.success,
    borderRadius: 2,
    minHeight: 36,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    gap: 2,
  },
  senderName: {
    color: colorss.success,
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.1,
  },
  previewText: {
    color: colorss.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  thumbnailWrapper: {
    borderRadius: 6,
    overflow: 'hidden',
  },
  thumbnail: {
    width: 44,
    height: 44,
    borderRadius: 6,
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    color: colorss.white,
    fontSize: 14,
  },
  voiceIcon: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 44,
    height: 44,
  },
  closeBtn: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
});
