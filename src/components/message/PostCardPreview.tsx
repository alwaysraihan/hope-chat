/**
 * In-chat preview for a shared hopenity.com post / feel.
 *
 * Mirrors ProductCardPreview: its own neutral surface rather than a tint of the
 * bubble, so the text keeps contrast on both the pink outgoing bubble and the
 * grey incoming one.
 */

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import { ExternalLink, Play } from 'lucide-react-native';

import {
  fetchHopenityPost,
  type HopenityPost,
} from '../../services/hopenityPostService';
import { colorss } from '../../theme';

interface Props {
  postId: string;
  onPress: () => void;
  isDark?: boolean;
}

export const PostCardPreview: React.FC<Props> = ({ postId, onPress, isDark }) => {
  const [post, setPost] = useState<HopenityPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchHopenityPost(postId)
      .then(p => {
        if (cancelled) return;
        if (p) setPost(p);
        else setFailed(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [postId]);

  // A deleted or private post should leave the plain link, not an error card.
  if (failed) return null;

  const cardBg = isDark ? '#1E1E2E' : '#FFFFFF';
  const cardBorder = isDark ? '#33334A' : '#E6E6EF';
  const titleColor = isDark ? '#F0F0F0' : '#111827';
  const subColor = isDark ? '#9A9AB0' : '#6B7280';

  if (loading) {
    return (
      <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
        <ActivityIndicator size="small" color={colorss.primary} style={styles.spinner} />
      </View>
    );
  }

  const isVideo = post?.mediaType === 'VIDEO';

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {post?.thumbnailUrl ? (
        <View>
          <FastImage
            source={{ uri: post.thumbnailUrl }}
            style={styles.media}
            resizeMode={FastImage.resizeMode.cover}
          />
          {isVideo ? (
            <View style={styles.playBadge}>
              <Play size={16} color="#fff" fill="#fff" />
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.info}>
        {post?.authorName ? (
          <View style={styles.authorRow}>
            {post.authorAvatar ? (
              <FastImage
                source={{ uri: post.authorAvatar }}
                style={styles.authorAvatar}
              />
            ) : null}
            <Text style={[styles.author, { color: titleColor }]} numberOfLines={1}>
              {post.authorName}
            </Text>
          </View>
        ) : null}

        {post?.caption ? (
          <Text style={[styles.caption, { color: titleColor }]} numberOfLines={3}>
            {post.caption}
          </Text>
        ) : null}

        <View style={styles.viewBtn}>
          <ExternalLink size={12} color="#fff" />
          <Text style={styles.viewBtnText}>View post</Text>
        </View>
        <Text style={[styles.domain, { color: subColor }]} numberOfLines={1}>
        Hopenity
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 6,
    width: 210,
    borderWidth: StyleSheet.hairlineWidth,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
  },
  spinner: { padding: 16 },
  media: { width: '100%', height: 130 },
  playBadge: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { padding: 10, gap: 3 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  authorAvatar: { width: 18, height: 18, borderRadius: 9 },
  author: { flex: 1, fontSize: 12, fontWeight: '700' },
  caption: { fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 6,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colorss.primary,
  },
  viewBtnText: { fontSize: 12.5, fontWeight: '700', color: '#fff' },
  domain: { fontSize: 10.5, textAlign: 'center', marginTop: 4 },
});
