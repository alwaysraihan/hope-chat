import React from 'react';
import { View, TouchableOpacity, Text, Image, StyleSheet } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import FastImage from '@d11/react-native-fast-image';
import { X } from 'lucide-react-native';
import { ExtendedMessage } from '../types/chat';

type ReplyMessageBarProps = {
  clearReply: () => void;
  message: ExtendedMessage | null;
  onReplyPress?: (messageId: string | number) => void;
};

const ReplyMessageBar: React.FC<ReplyMessageBarProps> = ({
  clearReply,
  message,
  onReplyPress,
}) => {
  if (!message) return null;

  const isVoice = message.media?.type === 'voice';
  const isImage = message.media?.type === 'image';
  const isVideo = message.media?.type === 'video';
  const hasMedia = isVoice || isImage || isVideo;

  const previewUri = isImage || isVideo
    ? message.media?.url || message.media?.remoteUri || message.media?.localUri
    : null;

  const previewThumbnail = isVideo ? message.media?.thumbnail : null;

  const getPreviewText = (): string => {
    if (isVoice) return '🎤 Voice message';
    if (isVideo) return '🎬 Video';
    if (isImage) return '📷 Photo';
    return message.text?.length > 80
      ? message.text.substring(0, 80) + '…'
      : message.text || '';
  };

  return (
    <Animated.View
      style={styles.container}
      entering={FadeInDown.duration(200).springify()}
      exiting={FadeOutDown.duration(150)}
    >
      {/* Accent bar */}
      <View style={styles.accentBar} />

      {/* Content */}
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
      {(isImage || isVideo) && (previewUri || previewThumbnail) && (
        <View style={styles.thumbnailWrapper}>
          <FastImage
            source={{ uri: previewThumbnail ?? previewUri! }}
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

      {/* Close */}
      <TouchableOpacity onPress={clearReply} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <X size={18} color="#667781" />
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F2F5',
    borderTopWidth: 1,
    borderTopColor: '#E9EDEF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 58,
    gap: 10,
  },
  accentBar: {
    width: 3,
    alignSelf: 'stretch',
    backgroundColor: '#00A884',
    borderRadius: 2,
    minHeight: 36,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    gap: 2,
  },
  senderName: {
    color: '#00A884',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.1,
  },
  previewText: {
    color: '#667781',
    fontSize: 13,
    lineHeight: 18,
  },
  thumbnailWrapper: {
    position: 'relative',
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
    color: '#fff',
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

export default React.memo(ReplyMessageBar);
