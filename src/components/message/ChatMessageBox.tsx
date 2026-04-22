import React, { useCallback } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { IMessage, MessageProps } from 'react-native-gifted-chat';
import FastImage from '@d11/react-native-fast-image';
import Video from 'react-native-video';
import AudioPlayer from './AudioPlayer';
import Reaction from './Reaction';
import { ExtendedMessage } from '../types/chat';

// Pull in your theme colors
const colors = {
  backgroundDeep: '#1a1a2e',
  accent: '#F72585',
  textLight: '#f1f5f9',
};

type ChatMessageBoxProps = {
  onPressReactions?: () => void;
  onMediaPress?: (url: string, type: 'image' | 'video') => void;
  refreshTrigger?: number;
} & MessageProps<IMessage>;

export default function ChatMessageBox(props: ChatMessageBoxProps) {
  const { currentMessage, position, onPressReactions, onMediaPress } = props;
  const msg = currentMessage as ExtendedMessage;
  const media = msg?.media;
  const isOwn = position === 'right';

  const reactionProps = {
    currentMessage: msg,
    position: position as 'left' | 'right',
    onPressReactions,
  };

  const handleMediaPress = useCallback(
    (url: string, type: 'image' | 'video') => {
      onMediaPress?.(url, type);
    },
    [onMediaPress],
  );

  // ── Voice ──────────────────────────────────────────────────────────────
  if (media?.type === 'voice') {
    const audioUri = media.remoteUri ?? media.url ?? media.localUri ?? '';
    return (
      <Reaction {...reactionProps}>
        <View
          style={[
            styles.mediaWrapper,
            isOwn ? styles.alignRight : styles.alignLeft,
          ]}
        >
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

  // ── Image ──────────────────────────────────────────────────────────────
  if (media?.type === 'image') {
    const imageUri = media.url ?? media.remoteUri ?? media.localUri ?? '';
    return (
      <Reaction {...reactionProps}>
        <TouchableOpacity
          activeOpacity={0.92}
          onPress={() => imageUri && handleMediaPress(imageUri, 'image')}
          style={[
            styles.mediaWrapper,
            isOwn ? styles.alignRight : styles.alignLeft,
          ]}
        >
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
        </TouchableOpacity>
      </Reaction>
    );
  }

  // ── Video ──────────────────────────────────────────────────────────────
  if (media?.type === 'video') {
    const videoUri = media.url ?? media.remoteUri ?? media.localUri ?? '';
    const thumbUri = media.thumbnail ?? undefined;
    return (
      <Reaction {...reactionProps}>
        <TouchableOpacity
          activeOpacity={0.92}
          onPress={() => videoUri && handleMediaPress(videoUri, 'video')}
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
        </TouchableOpacity>
      </Reaction>
    );
  }

  // ── Text ───────────────────────────────────────────────────────────────
  return (
    <Reaction {...reactionProps}>
      <View
        style={[
          styles.textBubble,
          isOwn ? styles.textBubbleRight : styles.textBubbleLeft,
        ]}
      >
        <Text style={styles.messageText}>{msg?.text ?? ''}</Text>
      </View>
    </Reaction>
  );
}

const styles = StyleSheet.create({
  alignLeft: { alignSelf: 'flex-start', marginLeft: 12 },
  alignRight: {},

  mediaWrapper: {
    maxWidth: '90%',
    marginVertical: 2,
  },

  // Text bubble
  textBubble: {
    maxWidth: '72%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
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
  messageText: {
    color: colors.textLight,
    fontSize: 14.5,
    lineHeight: 20,
    letterSpacing: 0.1,
  },

  // Image / Video bubble
  imageBubble: {
    width: 210,
    height: 210,
    borderRadius: 14,
    backgroundColor: '#1e1e2e',
  },

  // Overlays
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
