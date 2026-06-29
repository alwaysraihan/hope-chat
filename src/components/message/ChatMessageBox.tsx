import React, { useCallback, useState } from 'react';
import {
  Alert,
  Dimensions,
  Linking,
  Modal,
  Platform,
  Pressable,
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
import { Toast } from '../Toast';
import { useAppTheme } from '../../context/ThemeContext';

// ─── Constants ────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAX_BUBBLE_WIDTH = SCREEN_WIDTH * 0.78;
const MIN_BUBBLE_WIDTH_WITH_REPLY = SCREEN_WIDTH * 0.58;

// ─── Types ────────────────────────────────────────────────────────────────────

type ChatMessageBoxProps = {
  onPressReactions?: () => void;
  refreshTrigger?: number;
  isGroup?: boolean;
  /** Called when the sender avatar/name is tapped in a group message. */
  onSenderPress?: (userId: string, name: string) => void;
} & MessageProps<IMessage>;

// ─── Link helpers ─────────────────────────────────────────────────────────────

const URL_RE = /(https?:\/\/[^\s]+)/gi;

function isHopenityUrl(url: string): boolean {
  return /hopenity\.com|hoppi\.live/i.test(url);
}

function openHopenityDeepOrWeb(url: string): void {
  // Try to open in the Hopenity app via deep link, fall back to browser.
  const deepLink =
    Platform.OS === 'ios'
      ? url.replace(/^https?:\/\/(www\.)?hopenity\.com/, 'hopenity://hopenity.com')
             .replace(/^https?:\/\/(www\.)?hoppi\.live/, 'hopenity://hopenity.com')
      : url.replace(/^https?:\/\/(www\.)?hopenity\.com/, 'hopenity://hopenity.com')
             .replace(/^https?:\/\/(www\.)?hoppi\.live/, 'hopenity://hopenity.com');
  Linking.canOpenURL(deepLink)
    .then(ok => Linking.openURL(ok ? deepLink : url))
    .catch(() => Linking.openURL(url).catch(() => {}));
}

function handleLinkPress(url: string): void {
  if (isHopenityUrl(url)) {
    openHopenityDeepOrWeb(url);
    return;
  }
  Alert.alert(
    'Open link?',
    url.length > 80 ? url.slice(0, 80) + '…' : url,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Open', onPress: () => Linking.openURL(url).catch(() => {}) },
    ],
  );
}

/** Splits text into plain segments and URL segments for inline link rendering. */
function parseTextWithLinks(text: string): Array<{ text: string; isLink: boolean; url?: string }> {
  const parts: Array<{ text: string; isLink: boolean; url?: string }> = [];
  let last = 0;
  let match: RegExpExecArray | null;
  URL_RE.lastIndex = 0;
  while ((match = URL_RE.exec(text)) !== null) {
    if (match.index > last) {
      parts.push({ text: text.slice(last, match.index), isLink: false });
    }
    parts.push({ text: match[0], isLink: true, url: match[0] });
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    parts.push({ text: text.slice(last), isLink: false });
  }
  return parts.length > 0 ? parts : [{ text, isLink: false }];
}

// ─── Download helper ──────────────────────────────────────────────────────────

async function downloadMediaToGallery(
  remoteUrl: string,
  type: 'image' | 'video',
): Promise<void> {
  Toast.loading('Saving to gallery…');
  try {
    const ext = type === 'video' ? 'mp4' : 'jpg';
    const destPath = `${
      RNFS.CachesDirectoryPath
    }/hopechat_dl_${Date.now()}.${ext}`;
    await RNFS.downloadFile({ fromUrl: remoteUrl, toFile: destPath }).promise;
    await CameraRoll.saveAsset(destPath, {
      type: type === 'video' ? 'video' : 'photo',
    });
    Toast.success('Saved to gallery!');
  } catch {
    Toast.error('Could not save. Please try again.');
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

// ─── Media action sheet (replaces system Alert) ───────────────────────────────

function MediaActionSheet({
  url,
  type,
  onClose,
}: {
  url: string | null;
  type: 'image' | 'video';
  onClose: () => void;
}) {
  if (!url) return null;
  const label = type === 'video' ? 'video' : 'photo';
  return (
    <Modal
      transparent
      animationType="slide"
      visible={!!url}
      onRequestClose={onClose}
    >
      <Pressable style={sheet.backdrop} onPress={onClose} />
      <View style={sheet.container}>
        <View style={sheet.handle} />
        <TouchableOpacity
          style={sheet.action}
          onPress={() => {
            onClose();
            downloadMediaToGallery(url, type);
          }}
          activeOpacity={0.7}
        >
          <Text style={sheet.actionIcon}>{type === 'video' ? '🎬' : '🖼️'}</Text>
          <Text style={sheet.actionText}>Save {label} to gallery</Text>
        </TouchableOpacity>
        <View style={sheet.divider} />
        <TouchableOpacity
          style={sheet.action}
          onPress={onClose}
          activeOpacity={0.7}
        >
          <Text style={sheet.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const sheet = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  container: {
    backgroundColor: colorss.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    paddingHorizontal: 0,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colorss.border,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  actionIcon: { fontSize: 22 },
  actionText: { fontSize: 16, fontWeight: '500', color: colorss.textPrimary },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colorss.border,
    marginHorizontal: 0,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: colorss.error,
    textAlign: 'center',
    flex: 1,
  },
});

// ─── Component ────────────────────────────────────────────────────────────────

export default function ChatMessageBox(props: ChatMessageBoxProps) {
  const { currentMessage, position, onPressReactions, isGroup, onSenderPress } = props;
  const { handlePressReplyPreview } = useInbox();
  const msg = currentMessage as ExtendedMessage;
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'image' | 'video'>('image');
  const [sheetUrl, setSheetUrl] = useState<string | null>(null);
  const [sheetType, setSheetType] = useState<'image' | 'video'>('image');
  const { isDark, colors } = useAppTheme();
  const openPreview = useCallback((url: string, type: 'image' | 'video') => {
    setPreviewType(type);
    setPreviewUrl(url);
  }, []);

  const openSheet = useCallback((url: string, type: 'image' | 'video') => {
    setSheetType(type);
    setSheetUrl(url);
  }, []);

  if (msg.threadIntro) {
    const introFirst =
      (msg.threadIntro.peerName ?? '').trim().split(/\s+/)[0] || 'Friend';
    return (
      <View
        style={{ width: SCREEN_WIDTH, alignSelf: 'center', marginBottom: 6 }}
      >
        <ChatThreadIntroCard
          messagesExist={props.nextMessage != null}
          peerName={msg.threadIntro.peerName}
          subtitle={msg.threadIntro.subtitle}
          avatarUrl={msg.threadIntro.avatarUrl}
          prompt={
            msg.text || `Say hi to your new Hopenity friend, ${introFirst}.`
          }
        />
      </View>
    );
  }

  const media = msg?.media;
  const isOwn = position === 'right';
  const replyTo = msg?.replyTo;
  const hasReply = !!replyTo;

  const isGroupIncoming = !!isGroup && !isOwn;
  const senderName = isGroupIncoming ? msg.user?.name ?? '' : '';
  const senderAvatar =
    isGroupIncoming && typeof msg.user?.avatar === 'string'
      ? (msg.user.avatar as string)
      : null;
  const senderUserId = isGroupIncoming ? String(msg.user?._id ?? '') : '';
  const SenderHeader =
    isGroupIncoming && senderName ? (
      <TouchableOpacity
        style={styles.senderRow}
        onPress={() => onSenderPress?.(senderUserId, senderName)}
        activeOpacity={onSenderPress ? 0.6 : 1}
        disabled={!onSenderPress}
      >
        {senderAvatar ? (
          <FastImage
            source={{ uri: senderAvatar }}
            style={styles.senderAvatar}
          />
        ) : (
          <View style={styles.senderAvatarPlaceholder}>
            <Text style={styles.senderAvatarInitial}>
              {senderName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <Text style={styles.senderName} numberOfLines={1}>
          {senderName}
        </Text>
      </TouchableOpacity>
    ) : null;

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
        <View
          style={[styles.column, isOwn ? styles.alignRight : styles.alignLeft]}
        >
          {SenderHeader}
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
    const autoSave = getAutoSavePhotos();
    if (autoSave && imageUri && !isOwn && !media.uploading) {
      downloadMediaToGallery(imageUri, 'image').catch(() => undefined);
    }
    return (
      <Reaction {...reactionProps}>
        <View
          style={[styles.column, isOwn ? styles.alignRight : styles.alignLeft]}
        >
          {SenderHeader}
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
          <TouchableOpacity
            onPress={() =>
              !media.uploading && imageUri && openPreview(imageUri, 'image')
            }
            onLongPress={() =>
              !media.uploading && imageUri && openSheet(imageUri, 'image')
            }
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
        <MediaActionSheet
          url={sheetUrl}
          type={sheetType}
          onClose={() => setSheetUrl(null)}
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
        <View
          style={[styles.column, isOwn ? styles.alignRight : styles.alignLeft]}
        >
          {SenderHeader}
          <TouchableOpacity
            style={styles.mediaWrapper}
            onPress={() =>
              !media.uploading && videoUri && openPreview(videoUri, 'video')
            }
            onLongPress={() =>
              !media.uploading && videoUri && openSheet(videoUri, 'video')
            }
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
          <MediaActionSheet
            url={sheetUrl}
            type={sheetType}
            onClose={() => setSheetUrl(null)}
          />
        </View>
      </Reaction>
    );
  }

  // ── Text ───────────────────────────────────────────────────────────────────
  let textBg = colors.primary;

  if (!isOwn && isDark) {
    textBg = colors.cardBg;
  } else if (!isOwn && !isDark) {
    textBg = colors.bubbleIn;
  }

  let textColor = '#fff';

  if (!isOwn && isDark) {
    textColor = '#fff';
  } else if (!isOwn && !isDark) {
    textColor = '#000';
  }

  return (
    <Reaction {...reactionProps}>
      <View
        style={[styles.column, isOwn ? styles.alignRight : styles.alignLeft]}
      >
        {SenderHeader}
        <View
          style={[
            styles.textBubble,
            isOwn ? styles.textBubbleRight : styles.textBubbleLeft,
            hasReply && styles.textBubbleWithReply,
            { backgroundColor: textBg },
          ]}
        >
          {ReplySnippet}
          <Text
            style={[
              styles.messageText,
              { color: textColor },
              msg.messageKind === 'call_log' ? styles.callLogText : null,
            ]}
          >
            {parseTextWithLinks(msg?.text ?? '').map((seg, i) =>
              seg.isLink ? (
                <Text
                  key={i}
                  style={styles.linkText}
                  onPress={() => handleLinkPress(seg.url!)}
                >
                  {seg.text}
                </Text>
              ) : (
                seg.text
              ),
            )}
          </Text>
        </View>
      </View>
    </Reaction>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  alignLeft: { alignSelf: 'flex-start', marginLeft: 12 },
  alignRight: { alignSelf: 'flex-end', marginRight: 12 },
  mediaWrapper: { maxWidth: MAX_BUBBLE_WIDTH, marginVertical: 2 },
  senderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  senderAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  senderAvatarPlaceholder: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colorss.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  senderAvatarInitial: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: colorss.textSecondary,
    maxWidth: MAX_BUBBLE_WIDTH - 30,
  },
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
    flexShrink: 0,
  },
  textBubbleLeft: {
    alignSelf: 'flex-start',
    borderTopLeftRadius: 4,
  },
  textBubbleRight: {
    alignSelf: 'flex-end',
    borderTopRightRadius: 4,
  },
  textBubbleWithReply: { minWidth: MIN_BUBBLE_WIDTH_WITH_REPLY },
  messageText: {
    fontSize: 14.5,
    lineHeight: 20,
    letterSpacing: 0.1,
    flexShrink: 0,
    flexWrap: 'wrap',
  },
  callLogText: { fontStyle: 'italic', fontSize: 14 },
  linkText: { textDecorationLine: 'underline', opacity: 0.85 },
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
  overlayText: {
    color: colorss.white,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
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
