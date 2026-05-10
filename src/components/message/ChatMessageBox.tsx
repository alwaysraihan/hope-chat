import React, { useCallback } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { IMessage, MessageProps } from 'react-native-gifted-chat';
import FastImage from '@d11/react-native-fast-image';
import Video from 'react-native-video';

import ChatThreadIntroCard from './ChatThreadIntroCard';
import AudioPlayer from './AudioPlayer';
import ReplyPreview from './ReplyPreview';
import Reaction from './Reaction';
import { ExtendedMessage } from '../types/chat';
import { useInbox } from '../../context/InboxContext';
import { colorss } from '../../theme';

// ─── Constants ────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAX_BUBBLE_WIDTH = SCREEN_WIDTH * 0.78;
const MIN_BUBBLE_WIDTH_WITH_REPLY = SCREEN_WIDTH * 0.58;

// ─── Types ────────────────────────────────────────────────────────────────────

type ChatMessageBoxProps = {
  onPressReactions?: () => void;
  refreshTrigger?: number;
} & MessageProps<IMessage>;

// ─── Component ────────────────────────────────────────────────────────────────
// onReact / onReply / onDelete / onForward / onPressReplyPreview are all
// consumed from InboxContext — no prop drilling needed from InboxScreen.

export default function ChatMessageBox(props: ChatMessageBoxProps) {
  const { currentMessage, position, onPressReactions } = props;

  const { handlePressReplyPreview } = useInbox();

  const msg = currentMessage as ExtendedMessage;

  if (msg.threadIntro) {
    const introFirst =
      (msg.threadIntro.peerName ?? '').trim().split(/\s+/)[0] || 'Friend';
    return (
      <View style={{ width: SCREEN_WIDTH, alignSelf: 'center', marginBottom: 6 }}>
        <ChatThreadIntroCard
          peerName={msg.threadIntro.peerName}
          subtitle={msg.threadIntro.subtitle}
          avatarUrl={msg.threadIntro.avatarUrl}
          prompt={
            msg.text ||
            `Say hi to your new Hopenity friend, ${introFirst}.`
          }
        />
      </View>
    );
  }

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
    () => replyTo && handlePressReplyPreview(replyTo._id),
    [replyTo, handlePressReplyPreview],
  );

  const ReplySnippet = hasReply ? (
    <ReplyPreview
      replyTo={replyTo!}
      isOwn={isOwn}
      onPress={handleReplyPreviewPress}
      style={styles.replyStretch}
    />
  ) : null;

  // ── Voice ──────────────────────────────────────────────────────────────────

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

  // ── Image ──────────────────────────────────────────────────────────────────

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
            style={styles.mediaBubble}
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

  // ── Video ──────────────────────────────────────────────────────────────────

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
          {thumbUri ? (
            <FastImage
              source={{ uri: thumbUri }}
              style={styles.mediaBubble}
              resizeMode={FastImage.resizeMode.cover}
            />
          ) : (
            <Video
              source={{ uri: videoUri }}
              style={styles.mediaBubble}
              paused
              resizeMode="cover"
            />
          )}
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

  // ── Text ───────────────────────────────────────────────────────────────────

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
        <Text
          style={[
            styles.messageText,
            isOwn ? styles.messageTextOutgoing : styles.messageTextIncoming,
            msg.messageKind === 'call_log' ? styles.callLogText : null,
          ]}
        >
          {msg?.text ?? ''}
        </Text>
        {isOwn && !msg.pending && msg.delivery?.state ? (
          <Text
            style={[
              styles.deliveryFoot,
              isOwn ? styles.deliveryFootOut : styles.deliveryFootIn,
            ]}
            accessibilityLabel={
              msg.delivery.state === 'read'
                ? 'Read'
                : msg.delivery.state === 'delivered'
                  ? 'Delivered'
                  : 'Sent'
            }
          >
            {msg.delivery.state === 'read'
              ? 'Read'
              : msg.delivery.state === 'delivered'
                ? 'Delivered'
                : 'Sent'}
          </Text>
        ) : null}
      </View>
    </Reaction>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  alignLeft: { alignSelf: 'flex-start', marginLeft: 12 },
  alignRight: { alignSelf: 'flex-end', marginRight: 12 },
  mediaWrapper: { maxWidth: '90%', marginVertical: 2 },
  column: {
    maxWidth: MAX_BUBBLE_WIDTH,
    marginVertical: 2,
    flexDirection: 'column',
    gap: 3,
  },
  replyWrap: { borderRadius: 10, overflow: 'hidden' },
  replyOwn: { backgroundColor: 'rgba(0,0,0,0.22)' },
  replyOther: { backgroundColor: 'rgba(0,0,0,0.06)' },
  replyStretch: { alignSelf: 'stretch', marginBottom: 0 },

  // Text bubble
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
    backgroundColor: '#eaeef3',
    borderTopLeftRadius: 4,
  },
  textBubbleRight: {
    alignSelf: 'flex-end',
    marginRight: 12,
    backgroundColor: colorss.primary,
    borderTopRightRadius: 4,
  },
  textBubbleWithReply: { minWidth: MIN_BUBBLE_WIDTH_WITH_REPLY },
  messageText: {
    fontSize: 14.5,
    lineHeight: 20,
    letterSpacing: 0.1,
    flexShrink: 1,
  },
  messageTextOutgoing: {
    color: colorss.white,
  },
  messageTextIncoming: {
    color: colorss.textPrimary,
  },
  callLogText: {
    fontStyle: 'italic',
    fontSize: 14,
  },
  deliveryFoot: {
    alignSelf: 'flex-end',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 3,
    letterSpacing: 0.2,
  },
  deliveryFootOut: {
    color: 'rgba(255,255,255,0.82)',
  },
  deliveryFootIn: {
    color: colorss.textSecondary,
  },

  // Media
  mediaBubble: {
    width: 210,
    height: 210,
    borderRadius: 14,
    backgroundColor: colorss.backgroundDeep,
  },

  // Overlays
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.42)',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayError: { backgroundColor: `${colorss.error}B3` },
  overlayText: {
    color: colorss.white,
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
  playTriangle: { color: colorss.white, fontSize: 20, marginLeft: 3 },
});
