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
          style={[styles.senderName, { color: nameColor }]}
          numberOfLines={1}
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
            style={[styles.previewLabel, { color: textColor }]}
            numberOfLines={2}
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
  wrapper: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 8,
    borderLeftWidth: 3,
    overflow: 'hidden',
    marginBottom: 5,
    minHeight: 42,
  },
  textSection: {
    flex: 1,
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
