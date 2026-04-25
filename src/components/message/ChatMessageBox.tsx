import React, { useCallback } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { IMessage, MessageProps } from 'react-native-gifted-chat';
import FastImage from '@d11/react-native-fast-image';
import AudioPlayer from './AudioPlayer';
import ReplyPreview from './ReplyPreview';
import Reaction from './Reaction';
import { ExtendedMessage } from '../types/chat';
import Video from 'react-native-video';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Bubble can never be wider than 78% of screen
const MAX_BUBBLE_WIDTH = SCREEN_WIDTH * 0.78;
// When a reply preview is inside, enforce this minimum so the preview doesn't collapse
const MIN_BUBBLE_WIDTH_WITH_REPLY = SCREEN_WIDTH * 0.58;

const colors = {
  backgroundDeep: '#1a1a2e',
  accent: '#F72585',
  textLight: '#f1f5f9',
};

type ChatMessageBoxProps = {
  onPressReactions?: () => void;
  onPressReplyPreview?: (messageId: string | number) => void;
  refreshTrigger?: number;
} & MessageProps<IMessage>;

export default function ChatMessageBox(props: ChatMessageBoxProps) {
  const { currentMessage, position, onPressReactions, onPressReplyPreview } =
    props;

  const msg = currentMessage as ExtendedMessage;
  const media = msg?.media;
  const isOwn = position === 'right';
  const replyTo = msg?.replyTo;
  const hasReply = !!replyTo;

  const reactionProps = {
    currentMessage: msg,
    position: position as 'left' | 'right',
    onPressReactions,
  };

  const handleReplyPreviewPress = useCallback(
    () => replyTo && onPressReplyPreview?.(replyTo._id),
    [replyTo, onPressReplyPreview],
  );

  const ReplySnippet = hasReply ? (
    <ReplyPreview
      replyTo={replyTo!}
      isOwn={isOwn}
      onPress={handleReplyPreviewPress}
      style={styles.replyStretch}
    />
  ) : null;

  // ── Voice
  if (media?.type === 'voice') {
    const audioUri = media.remoteUri ?? media.url ?? media.localUri ?? '';
    return (
      <Reaction {...reactionProps}>
        <View
          style={[styles.column, isOwn ? styles.alignRight : styles.alignLeft]}
        >
          {ReplySnippet && (
            <View
              style={[
                styles.replyWrap,
                isOwn ? styles.replyOwn : styles.replyOther,
              ]}
            >
              {ReplySnippet}
            </View>
          )}
          <AudioPlayer
            audioPath={audioUri}
            duration={media.duration ?? 0}
            remoteUri={media.remoteUri}
            uploading={media.uploading}
            createdAt={msg.createdAt as Date}
            isOwn={isOwn}
          />
        </View>
      </Reaction>
    );
  }

  // ── Image
  if (media?.type === 'image') {
    const imageUri = media.url ?? media.remoteUri ?? media.localUri ?? '';
    return (
      <Reaction {...reactionProps}>
        <View
          style={[styles.column, isOwn ? styles.alignRight : styles.alignLeft]}
        >
          {ReplySnippet && (
            <View
              style={[
                styles.replyWrap,
                isOwn ? styles.replyOwn : styles.replyOther,
              ]}
            >
              {ReplySnippet}
            </View>
          )}

          <FastImage
            source={{ uri: imageUri }}
            style={styles.imageBubble}
            resizeMode={FastImage.resizeMode.cover}
          />
          {media.uploading && (
            <View style={styles.overlay}>
              <Text style={styles.overlayText}>Uploading…</Text>
            </View>
          )}
          {media.error && (
            <View style={[styles.overlay, styles.overlayError]}>
              <Text style={styles.overlayText}>Upload failed</Text>
            </View>
          )}
        </View>
      </Reaction>
    );
  }

  // ── Video
  if (media?.type === 'video') {
    const videoUri = media.url ?? media.remoteUri ?? media.localUri ?? '';
    const thumbUri = media.thumbnail ?? undefined;
    return (
      <Reaction {...reactionProps}>
        <View
          style={[
            styles.mediaWrapper,
            isOwn ? styles.alignRight : styles.alignLeft,
          ]}
        >
          {/* Show thumbnail if available, else use Video as poster */}
          {thumbUri ? (
            <FastImage
              source={{ uri: thumbUri }}
              style={styles.imageBubble}
              resizeMode={FastImage.resizeMode.cover}
            />
          ) : (
            <Video
              source={{ uri: videoUri }}
              style={styles.imageBubble}
              paused
              resizeMode="cover"
              poster={thumbUri}
            />
          )}
          {/* Play overlay */}
          <View style={styles.videoPlayOverlay}>
            <View style={styles.playCircle}>
              <Text style={styles.playTriangle}>▶</Text>
            </View>
          </View>
          {media.uploading && (
            <View style={styles.overlay}>
              <Text style={styles.overlayText}>Uploading…</Text>
            </View>
          )}
        </View>
      </Reaction>
    );
  }

  // ── Text
  return (
    <Reaction {...reactionProps}>
      <View
        style={[
          styles.textBubble,
          isOwn ? styles.textBubbleRight : styles.textBubbleLeft,
          hasReply && styles.textBubbleWithReply,
        ]}
      >
        {ReplySnippet}
        <Text style={styles.messageText}>{msg?.text ?? ''}</Text>
      </View>
    </Reaction>
  );
}

const styles = StyleSheet.create({
  // ── Layout helpers
  alignLeft: {
    alignSelf: 'flex-start',
    marginLeft: 12,
  },
  alignRight: {
    alignSelf: 'flex-end',
    marginRight: 12,
  },

  mediaWrapper: {
    maxWidth: '90%',
    marginVertical: 2,
  },

  column: {
    maxWidth: MAX_BUBBLE_WIDTH,
    marginVertical: 2,
    flexDirection: 'column',
    gap: 3,
  },
  replyWrap: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  replyOwn: {
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  replyOther: {
    backgroundColor: 'rgba(0,0,0,0.06)',
  },

  replyStretch: {
    alignSelf: 'stretch',
    marginBottom: 0,
  },

  textBubble: {
    maxWidth: MAX_BUBBLE_WIDTH,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 8,
    flexDirection: 'column',
  },
  textBubbleLeft: {
    alignSelf: 'flex-start',
    marginLeft: 12,
    backgroundColor: colors.backgroundDeep,
    borderTopLeftRadius: 4,
  },
  textBubbleRight: {
    alignSelf: 'flex-end',
    marginRight: 12,
    backgroundColor: colors.accent,
    borderTopRightRadius: 4,
  },
  textBubbleWithReply: {
    minWidth: MIN_BUBBLE_WIDTH_WITH_REPLY,
  },

  messageText: {
    color: colors.textLight,
    fontSize: 14.5,
    lineHeight: 20,
    letterSpacing: 0.1,
    flexShrink: 1,
  },
  imageBubble: {
    width: 210,
    height: 210,
    borderRadius: 14,
    backgroundColor: '#1e1e2e',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.42)',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayError: {
    backgroundColor: 'rgba(220,38,38,0.7)',
  },
  overlayText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  // Video play button
  videoPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14,
  },
  playCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  playTriangle: {
    color: '#fff',
    fontSize: 20,
    marginLeft: 3,
  },
});
