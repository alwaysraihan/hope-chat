import React, { useCallback, useState } from 'react';
import {
  Alert,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { IMessage, MessageProps } from 'react-native-gifted-chat';
import FastImage from '@d11/react-native-fast-image';
import Video from 'react-native-video';
import RNFS from 'react-native-fs';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';

import ChatThreadIntroCard from './ChatThreadIntroCard';
import AudioPlayer from './AudioPlayer';
import DonationRequestBubble from './DonationRequestBubble';
import MediaPreviewModal from './ImagePreviewModal';
import ReplyPreview from './ReplyPreview';
import Reaction from './Reaction';
import { ExtendedMessage } from '../types/chat';
import { useInbox } from '../../context/InboxContext';
import { colorss } from '../../theme';
import { getAutoSavePhotos } from '../../services/chatPrefs';

// ─── Constants ────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAX_BUBBLE_WIDTH = SCREEN_WIDTH * 0.78;
const MIN_BUBBLE_WIDTH_WITH_REPLY = SCREEN_WIDTH * 0.58;

// ─── Types ────────────────────────────────────────────────────────────────────

type ChatMessageBoxProps = {
  onPressReactions?: () => void;
  refreshTrigger?: number;
} & MessageProps<IMessage>;

// ─── Download helper ──────────────────────────────────────────────────────────

async function downloadMediaToGallery(
  remoteUrl: string,
  type: 'image' | 'video',
): Promise<void> {
  try {
    const ext = type === 'video' ? 'mp4' : 'jpg';
    const destPath = `${RNFS.CachesDirectoryPath}/hopechat_dl_${Date.now()}.${ext}`;
    await RNFS.downloadFile({ fromUrl: remoteUrl, toFile: destPath }).promise;
    await CameraRoll.saveAsset(destPath, { type: type === 'video' ? 'video' : 'photo' });
    Alert.alert('Saved', `${type === 'video' ? 'Video' : 'Photo'} saved to your gallery.`);
  } catch {
    Alert.alert('Download failed', 'Could not save the file. Please try again.');
  }
}

function showMediaActionSheet(
  url: string,
  type: 'image' | 'video',
): void {
  Alert.alert(
    type === 'video' ? 'Video' : 'Photo',
    undefined,
    [
      {
        text: `Save ${type === 'video' ? 'video' : 'photo'}`,
        onPress: () => downloadMediaToGallery(url, type),
      },
      { text: 'Cancel', style: 'cancel' },
    ],
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ChatMessageBox(props: ChatMessageBoxProps) {
  const { currentMessage, position, onPressReactions } = props;
  const { handlePressReplyPreview } = useInbox();
  const msg = currentMessage as ExtendedMessage;
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'image' | 'video'>('image');
  const openPreview = useCallback((url: string, type: 'image' | 'video') => {
    setPreviewType(type);
    setPreviewUrl(url);
  }, []);

  if (msg.threadIntro) {
    const introFirst =
      (msg.threadIntro.peerName ?? '').trim().split(/\s+/)[0] || 'Friend';
    return (
      <View style={{ width: SCREEN_WIDTH, alignSelf: 'center', marginBottom: 6 }}>
        <ChatThreadIntroCard
          messagesExist={props.nextMessage != null}
          peerName={msg.threadIntro.peerName}
          subtitle={msg.threadIntro.subtitle}
          avatarUrl={msg.threadIntro.avatarUrl}
          prompt={msg.text || `Say hi to your new Hopenity friend, ${introFirst}.`}
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

  // ── Donation request ───────────────────────────────────────────────────────

  if (msg.messageKind === 'donation_request') {
    return (
      <Reaction {...reactionProps}>
        <DonationRequestBubble message={msg} isOwn={isOwn} />
      </Reaction>
    );
  }

  // ── Voice ──────────────────────────────────────────────────────────────────

  if (media?.type === 'voice') {
    const audioUri = media.remoteUri ?? media.url ?? media.localUri ?? '';
    return (
      <Reaction {...reactionProps}>
        <View style={[styles.column, isOwn ? styles.alignRight : styles.alignLeft]}>
          {ReplySnippet && (
            <View style={[styles.replyWrap, isOwn ? styles.replyOwn : styles.replyOther]}>
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
    const autoSave = getAutoSavePhotos();
    if (autoSave && imageUri && !isOwn && !media.uploading) {
      downloadMediaToGallery(imageUri, 'image').catch(() => undefined);
    }
    return (
      <Reaction {...reactionProps}>
        <View style={[styles.column, isOwn ? styles.alignRight : styles.alignLeft]}>
          {ReplySnippet && (
            <View style={[styles.replyWrap, isOwn ? styles.replyOwn : styles.replyOther]}>
              {ReplySnippet}
            </View>
          )}
          <TouchableOpacity
            onPress={() => !media.uploading && imageUri && openPreview(imageUri, 'image')}
            onLongPress={() => !media.uploading && imageUri && showMediaActionSheet(imageUri, 'image')}
            activeOpacity={0.92}
            delayLongPress={350}
          >
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
          </TouchableOpacity>
        </View>
        <MediaPreviewModal
          visible={previewUrl !== null && previewType === 'image'}
          mediaUrl={previewUrl}
          mediaType="image"
          onClose={() => setPreviewUrl(null)}
        />
      </Reaction>
    );
  }

  // ── Video ──────────────────────────────────────────────────────────────────

  if (media?.type === 'video') {
    const videoUri = media.url ?? media.remoteUri ?? media.localUri ?? '';
    const thumbUri = media.thumbnail ?? undefined;
    return (
      <Reaction {...reactionProps}>
        <TouchableOpacity
          style={[styles.mediaWrapper, isOwn ? styles.alignRight : styles.alignLeft]}
          onPress={() => !media.uploading && videoUri && openPreview(videoUri, 'video')}
          onLongPress={() => !media.uploading && videoUri && showMediaActionSheet(videoUri, 'video')}
          activeOpacity={0.92}
          delayLongPress={350}
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
        </TouchableOpacity>
        <MediaPreviewModal
          visible={previewUrl !== null && previewType === 'video'}
          mediaUrl={previewUrl}
          mediaType="video"
          onClose={() => setPreviewUrl(null)}
        />
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
  messageText: { fontSize: 14.5, lineHeight: 20, letterSpacing: 0.1, flexShrink: 1 },
  messageTextOutgoing: { color: colorss.white },
  messageTextIncoming: { color: colorss.textPrimary },
  callLogText: { fontStyle: 'italic', fontSize: 14 },
  mediaBubble: {
    width: 210,
    height: 210,
    borderRadius: 14,
    backgroundColor: colorss.backgroundDeep,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.42)',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayError: { backgroundColor: `${colorss.error}B3` },
  overlayText: { color: colorss.white, fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
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
