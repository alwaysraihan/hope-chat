import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import FastImage from '@d11/react-native-fast-image';

import { ExtendedMessage } from '../types/chat';
import { colorss } from '../../theme';

//  Types

type ReplyTo = NonNullable<ExtendedMessage['replyTo']>;

interface ReplyPreviewProps {
  replyTo: ReplyTo;
  isOwn: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}

/** Bengali, Devanagari & co. — see hasComplexScript in ChatMessageBox. */
const COMPLEX_SCRIPT_RE =
  /[\u0900-\u0DFF\u0E00-\u0E7F\u1000-\u109F\u1780-\u17FF]/;

//  Component

const ReplyPreview: React.FC<ReplyPreviewProps> = ({
  replyTo,
  isOwn,
  onPress,
  style,
}) => {
  const mediaType = replyTo.media?.type;

  const thumbUri =
    mediaType === 'image' || mediaType === 'video'
      ? replyTo.media?.thumbnail ??
        replyTo.media?.url ??
        replyTo.media?.remoteUri ??
        replyTo.media?.localUri
      : null;

  const previewLabel = (() => {
    if (mediaType === 'voice') return '🎤  Voice message';
    if (mediaType === 'video') return '🎬  Video';
    if (mediaType === 'image') return '📷  Photo';
    if (replyTo.text) {
      // A quoted media/link message carries a bare URL as its text. Echoing that
      // URL is what made a reply to a product look like a raw link, and a reply
      // to a video read as an ordinary message. Name the thing instead.
      const t = replyTo.text.trim();
      if (/^https?:\/\/(www\.)?hoppi\.live\/product\//i.test(t)) {
        return '🛍️  Product';
      }
      if (/^https?:\/\/(www\.)?hopenity\.com\/(post|post_id|feels)\//i.test(t)) {
        return '📷  Post';
      }
      if (/^https?:\/\/\S+\.(m4a|mp3|aac|ogg|oga|opus|wav|amr|3ga|caf|weba|flac)(\?|$)/i.test(t)) {
        return '🎤  Voice message';
      }
      if (/^https?:\/\/\S+\.(mp4|mov|m3u8|webm|mkv|avi|3gp|m4v)(\?|$)/i.test(t)) {
        return '🎬  Video';
      }
      if (/^https?:\/\/\S+\.(jpg|jpeg|png|gif|webp|heic|heif|avif)(\?|$)/i.test(t)) {
        return '📷  Photo';
      }
      // Belt and braces: the quoted text is decrypted upstream now, but if the
      // conversation key is unavailable (fresh install, key not yet derived)
      // showing the raw "HC1:…" envelope is worse than saying nothing useful.
      if (replyTo.text.startsWith('HC1:') || replyTo.text.startsWith('HCG1:')) {
        return '🔒 Encrypted message';
      }
      return replyTo.text.length > 80
        ? replyTo.text.slice(0, 80) + '…'
        : replyTo.text;
    }
    return '';
  })();

  const accentColor = isOwn ? 'rgba(255,255,255,0.7)' : colorss.success;
  const bgColor = isOwn ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.07)';
  const nameColor = isOwn ? 'rgba(255,255,255,0.9)' : colorss.success;
  const textColor = isOwn ? 'rgba(255,255,255,0.75)' : colorss.textSecondary;
  // A fixed 17px line is shorter than Bengali's stacked matras, so the second
  // line was drawn below the box and clipped — the "reply text is cut off"
  // report. Let the font decide the line height for shaped scripts.
  const complex = COMPLEX_SCRIPT_RE.test(previewLabel) || COMPLEX_SCRIPT_RE.test(replyTo.user?.name ?? '');

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      style={[
        styles.wrapper,
        { backgroundColor: bgColor, borderLeftColor: accentColor },
        style,
      ]}
    >
      {/* Text section */}
      <View style={styles.textSection}>
        <Text
          style={[styles.senderName, complex && styles.complexText, { color: nameColor }]}
          numberOfLines={1}
          maxFontSizeMultiplier={1.3}
        >
          {replyTo.user?.name ?? 'Unknown'}
        </Text>

        {/* Voice waveform placeholder */}
        {mediaType === 'voice' && (
          <View style={styles.waveRow}>
            <Text style={[styles.previewLabel, { color: textColor }]}>🎤</Text>
            <View style={styles.miniBars}>
              {Array.from({ length: 14 }, (_, i) => (
                <View
                  key={i}
                  style={[
                    styles.miniBar,
                    {
                      height: 4 + (i % 3) * 4 + (i % 5) * 2,
                      backgroundColor: isOwn
                        ? 'rgba(255,255,255,0.55)'
                        : 'rgba(0,0,0,0.22)',
                    },
                  ]}
                />
              ))}
            </View>
          </View>
        )}

        {mediaType !== 'voice' && (
          <Text
            style={[styles.previewLabel, complex && styles.complexText, { color: textColor }]}
            numberOfLines={3}
            maxFontSizeMultiplier={1.3}
          >
            {previewLabel}
          </Text>
        )}
      </View>

      {/* Media thumbnail */}
      {thumbUri && (
        <View style={styles.thumbWrap}>
          <FastImage
            source={{ uri: thumbUri }}
            style={styles.thumb}
            resizeMode={FastImage.resizeMode.cover}
          />
          {mediaType === 'video' && (
            <View style={styles.videoPlayDot}>
              <Text style={styles.videoPlayIcon}>▶</Text>
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

export default React.memo(ReplyPreview);

//  Styles

const styles = StyleSheet.create({
  // No overflow:'hidden' here: it turned any text measured a few pixels short
  // into a clipped line. The thumbnail clips itself instead.
  wrapper: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 8,
    borderLeftWidth: 3,
    marginBottom: 5,
    minHeight: 42,
  },
  // grow/shrink with an auto basis, not flex:1 (basis 0): the text must be
  // measured at its real width for its height to come out right.
  textSection: {
    flexGrow: 1,
    flexShrink: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
    justifyContent: 'center',
    gap: 3,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  previewLabel: {
    fontSize: 12,
    lineHeight: 17,
  },
  complexText: {
    lineHeight: undefined,
    includeFontPadding: true,
    letterSpacing: 0,
  },
  waveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  miniBars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  miniBar: {
    width: 2.5,
    borderRadius: 1.5,
  },
  thumbWrap: {
    position: 'relative',
    width: 48,
    height: 48,
    overflow: 'hidden',
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
  },
  thumb: {
    width: 48,
    height: 48,
  },
  videoPlayDot: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  videoPlayIcon: {
    color: colorss.white,
    fontSize: 14,
    marginLeft: 2,
  },
});
