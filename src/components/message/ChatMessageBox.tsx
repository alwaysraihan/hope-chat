import React, { useCallback, useEffect, useState } from 'react';
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
import { ProductCardPreview } from './ProductCardPreview';
import { PostCardPreview } from './PostCardPreview';
import DonationRequestBubble from './DonationRequestBubble';
import BookingCardBubble from './BookingCardBubble';
import MediaPreviewModal from './ImagePreviewModal';
import ReplyPreview from './ReplyPreview';
import Reaction from './Reaction';
import { ExtendedMessage } from '../types/chat';
import { useInbox } from '../../context/InboxContext';
import { colorss } from '../../theme';
import { getAutoSavePhotos } from '../../services/chatPrefs';
import { Toast } from '../Toast';
import {
  claimAutoSave,
  hasAutoSaved,
  markAutoSaved,
  releaseAutoSave,
} from '../../services/autoSavedMedia';
import { useWindowDimensions } from 'react-native';

import { useAppTheme } from '../../context/ThemeContext';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Bubble widths.
 *
 * `Dimensions.get('window')` is read ONCE at module load, so these constants are
 * a snapshot of whatever the window was at that instant. On a device where the
 * app starts before the window is measured, in split-screen, on a foldable, or
 * after a rotation, every bubble keeps sizing to a stale width — which is why
 * message text appeared cut off on some devices and not others.
 *
 * The constants remain as the initial value for the StyleSheet; the component
 * overrides them from useWindowDimensions() so the real width always wins.
 */
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
// The trailing segment is a product REFERENCE, not a tidy slug: a variant line
// carries composite ids that include characters outside [A-Za-z0-9_-] (and are
// percent-encoded in the URL). The old class silently truncated at the first
// such character, so the card looked up a product id that does not exist and
// rendered nothing — which is why sharing a product VARIANT showed an empty
// message. Take everything up to a path/query boundary and decode it.
const HOPPI_PRODUCT_RE = /^https?:\/\/(www\.)?hoppi\.live\/product\/([^/?#\s]+)/i;
// /post/:id and /post_id/:id both reach a post; feels are posts too.
const HOPENITY_POST_RE =
  /^https?:\/\/(www\.)?hopenity\.com\/(?:post|post_id|feels)\/([a-zA-Z0-9_-]+)/i;

function extractProductSlug(url: string): string | null {
  const m = url.match(HOPPI_PRODUCT_RE);
  if (m?.[2]) {
    try {
      return decodeURIComponent(m[2]);
    } catch {
      return m[2];
    }
  }
  return null;
}

function extractPostId(url: string): string | null {
  const m = url.match(HOPENITY_POST_RE);
  return m ? m[2] : null;
}

function isHopenityUrl(url: string): boolean {
  return /hopenity\.com|hoppi\.live/i.test(url);
}

/**
 * Route a hopenity.com / hoppi.live link into the Hopenity app.
 *
 * Both platforms go through the `hopenity://` custom scheme, which Hopenity
 * registers on iOS (CFBundleURLSchemes) and Android (intent-filter), and which
 * Hope Chat declares under LSApplicationQueriesSchemes so canOpenURL sees it.
 *
 * iOS deliberately does NOT trust the HTTPS URL: Universal Links only fire when
 * the domain serves a valid apple-app-site-association, and canOpenURL can't
 * detect the failure because Safari claims every http(s) URL — so a broken AASA
 * sends the link to the browser with no fallback.
 *
 * The host must survive the rewrite: Hopenity dispatches hoppi links by
 * `host === 'hoppi.live'`, so mapping them onto hopenity.com drops /product/
 * and /seller/ into a branch with no such routes and the tap silently no-ops.
 */
function openHopenityDeepOrWeb(url: string): void {
  const deepLink = url
    .replace(/^https?:\/\/(www\.)?hopenity\.com/, 'hopenity://hopenity.com')
    .replace(/^https?:\/\/(www\.)?hoppi\.live/, 'hopenity://hoppi.live');
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

async function writeMediaToGallery(
  remoteUrl: string,
  type: 'image' | 'video',
): Promise<void> {
  const ext = type === 'video' ? 'mp4' : 'jpg';
  const destPath = `${
    RNFS.CachesDirectoryPath
  }/hopechat_dl_${Date.now()}.${ext}`;
  await RNFS.downloadFile({ fromUrl: remoteUrl, toFile: destPath }).promise;
  await CameraRoll.saveAsset(destPath, {
    type: type === 'video' ? 'video' : 'photo',
  });
}

/** Manual "Save to gallery" — user-initiated, so it reports what it did. */
async function downloadMediaToGallery(
  remoteUrl: string,
  type: 'image' | 'video',
): Promise<void> {
  Toast.loading('Saving to gallery…');
  try {
    await writeMediaToGallery(remoteUrl, type);
    Toast.success('Saved to gallery!');
  } catch {
    Toast.error('Could not save. Please try again.');
  }
}

/**
 * KILL SWITCH — auto-save is turned OFF for now.
 *
 * The feature is disabled at the point of ACTION, not by hiding the setting: the
 * toggle still reads and writes the user's preference, so nothing is lost and
 * re-enabling is a one-line change here. Nothing downloads or writes to the
 * gallery while this is true.
 *
 * The correctness work below (save-once bookkeeping, silent operation, the
 * effect instead of a render-time call) stays in place and is what should be
 * re-enabled — do NOT restore the old render-time download.
 */
const AUTO_SAVE_DISABLED = true;

/**
 * Auto-save — runs on its own, so it is SILENT and happens at most once per
 * image. No toast, no duplicate gallery entries, no re-download on re-render.
 */
async function autoSaveMediaOnce(
  remoteUrl: string,
  type: 'image' | 'video',
): Promise<void> {
  if (hasAutoSaved(remoteUrl) || !claimAutoSave(remoteUrl)) return;
  try {
    await writeMediaToGallery(remoteUrl, type);
    markAutoSaved(remoteUrl);
  } catch {
    // Leave it unmarked so a later attempt can retry — but the in-flight guard
    // and the render-effect below keep that from becoming a hot loop.
  } finally {
    releaseAutoSave(remoteUrl);
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

// ─── Media action sheet (replaces system Alert) ───────────────────────────────

function MediaActionSheet({
  url,
  type,
  onClose,
  onDelete,
}: {
  url: string | null;
  type: 'image' | 'video';
  onClose: () => void;
  /**
   * Only present for the user's own media. Long-pressing media opens THIS sheet,
   * which swallowed the gesture before the reaction tray (where Delete lives)
   * could appear — so a photo or video could never be deleted after sending.
   */
  onDelete?: () => void;
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
        {onDelete ? (
          <>
            <View style={sheet.divider} />
            <TouchableOpacity
              style={sheet.action}
              onPress={() => {
                onClose();
                onDelete();
              }}
              activeOpacity={0.7}
            >
              <Text style={sheet.actionIcon}>🗑️</Text>
              <Text style={[sheet.actionText, sheet.destructiveText]}>
                Delete {label}
              </Text>
            </TouchableOpacity>
          </>
        ) : null}
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
  destructiveText: { color: '#E5484D' },
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
  const { handlePressReplyPreview, handleDelete } = useInbox();
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

  // Live window width — see the note on MAX_BUBBLE_WIDTH above.
  const { width: windowWidth } = useWindowDimensions();
  const liveBubbleMax = windowWidth * 0.78;
  const bubbleWidthStyle = { maxWidth: liveBubbleMax };

  /**
   * Auto-save incoming photos.
   *
   * This used to run in the render body, so EVERY re-render of the message
   * (scroll, reaction, typing indicator, any parent state change) kicked off a
   * fresh download — which is why opening a chat downloaded the same images over
   * and over and buried the screen in toasts. An effect keyed on the URL runs it
   * once per image; `autoSaveMediaOnce` then makes it idempotent across mounts,
   * app restarts, and concurrent renders.
   */
  const autoSaveUri =
    media?.type === 'image'
      ? media.url ?? media.remoteUri ?? media.localUri ?? ''
      : '';
  const canAutoSave = !!autoSaveUri && !isOwn && !media?.uploading;
  useEffect(() => {
    if (AUTO_SAVE_DISABLED) return;
    if (!canAutoSave || !getAutoSavePhotos()) return;
    void autoSaveMediaOnce(autoSaveUri, 'image');
  }, [autoSaveUri, canAutoSave]);

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

  // ── System (membership announcements: "X added Y") ────────────────────────

  if (msg.messageKind === 'system') {
    return (
      <View style={styles.systemRow}>
        <Text style={[styles.systemText, { color: isDark ? '#9aa0a6' : '#8e8e93' }]}>
          {msg.text}
        </Text>
      </View>
    );
  }

  // ── Donation request ───────────────────────────────────────────────────────

  if (msg.messageKind === 'donation_request') {
    return (
      <Reaction {...reactionProps}>
        <DonationRequestBubble message={msg} isOwn={isOwn} />
      </Reaction>
    );
  }

  // ── Booking / Hope Wish confirmation ──────────────────────────────────────

  if (msg.messageKind === 'booking_card' && msg.bookingCard) {
    return (
      <Reaction {...reactionProps}>
        <BookingCardBubble booking={msg.bookingCard} isOwn={isOwn} />
      </Reaction>
    );
  }

  // ── Voice ──────────────────────────────────────────────────────────────────

  if (media?.type === 'voice') {
    const audioUri = media.remoteUri ?? media.url ?? media.localUri ?? '';
    return (
      <Reaction {...reactionProps}>
        <View
          style={[styles.column, bubbleWidthStyle, isOwn ? styles.alignRight : styles.alignLeft]}
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
    return (
      <Reaction {...reactionProps}>
        <View
          style={[styles.column, bubbleWidthStyle, isOwn ? styles.alignRight : styles.alignLeft]}
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
          onDelete={isOwn ? () => handleDelete(msg as IMessage) : undefined}
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
          style={[styles.column, bubbleWidthStyle, isOwn ? styles.alignRight : styles.alignLeft]}
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
            onDelete={isOwn ? () => handleDelete(msg as IMessage) : undefined}
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

  // Detect the first hoppi.live product URL in the message for a preview card.
  const rawText = msg?.text ?? '';
  const allUrls = rawText.match(URL_RE) ?? [];
  const productUrl = allUrls.find(u => extractProductSlug(u) != null) ?? null;
  const productSlug = productUrl ? extractProductSlug(productUrl) : null;
  // When the message is nothing but the product link, the card already says
  // everything the URL would — showing both stacks a long unreadable URL on it.
  const postUrl = allUrls.find(u => extractPostId(u) != null) ?? null;
  const postId = postUrl ? extractPostId(postUrl) : null;
  // When the message is nothing but the link, the card already says everything
  // the URL would — showing both stacks a long unreadable URL on it.
  const hideUrlText =
    (productSlug != null && rawText.trim() === productUrl) ||
    (postId != null && rawText.trim() === postUrl);

  return (
    <Reaction {...reactionProps}>
      <View
        style={[styles.column, bubbleWidthStyle, isOwn ? styles.alignRight : styles.alignLeft]}
      >
        {SenderHeader}
        <View
          style={[
            styles.textBubble,
              bubbleWidthStyle,
            isOwn ? styles.textBubbleRight : styles.textBubbleLeft,
            hasReply && styles.textBubbleWithReply,
            { backgroundColor: textBg },
          ]}
        >
          {ReplySnippet}
          {hideUrlText ? null : (
            <Text
              style={[
                styles.messageText,
                { color: textColor },
                msg.messageKind === 'call_log' ? styles.callLogText : null,
              ]}
            >
              {parseTextWithLinks(rawText).map((seg, i) =>
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
          )}
          {postId ? (
            <PostCardPreview
              postId={postId}
              isDark={isDark}
              onPress={() => handleLinkPress(postUrl!)}
            />
          ) : null}
          {productSlug ? (
            <ProductCardPreview
              slug={productSlug}
              isOwn={isOwn}
              isDark={isDark}
              onPress={() => handleLinkPress(productUrl!)}
            />
          ) : null}
        </View>
      </View>
    </Reaction>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  alignLeft: { alignSelf: 'flex-start', marginLeft: 12 },
  alignRight: { alignSelf: 'flex-end', marginRight: 12 },
  systemRow: {
    alignSelf: 'center',
    maxWidth: SCREEN_WIDTH * 0.8,
    marginVertical: 8,
    paddingHorizontal: 12,
  },
  systemText: {
    fontSize: 12,
    textAlign: 'center',
  },
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
    // Must be allowed to shrink, or the bubble refuses to narrow for wrapped
    // text and the content is cut at the edge.
    flexShrink: 1,
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
    // Emoji glyphs are drawn taller than the text they sit in. At lineHeight 20
    // for a 14.5 font, Android clipped them — they rendered blank or sliced,
    // which is why emoji "did not show" on some devices and were fine on others
    // (it depends on the system emoji font's metrics).
    lineHeight: 22,
    letterSpacing: 0.1,
    // Was flexShrink: 0, which stops the Text shrinking inside the bubble's
    // maxWidth — so long messages were clipped instead of wrapping. That is the
    // "message kete ase" (text cut off) report. flexWrap is a View-only style
    // and did nothing here.
    flexShrink: 1,
    // Android adds asymmetric padding from font metrics that compounds the
    // clipping above; the explicit lineHeight already controls spacing.
    includeFontPadding: false,
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
