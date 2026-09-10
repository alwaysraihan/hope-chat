/**
 * Story-reply message card — mirrors feusar's StoryPreviewCard
 * (Messages.tsx:333-399), which reads the same nested `story` object the
 * backend attaches to a message sent with `storyId`.
 *
 * Unlike the web version, this also gates on expiry and lets the card be
 * tapped to reopen the story itself.
 *
 * The message-embedded `story` object is a minimal stub — the backend only
 * returns `{id, media_url, type, content}` on it, no `thumbnail_url` or
 * `expires_at` at all (confirmed against the live API), so a video reply has
 * no poster image and expiry can never be determined from the message alone.
 * There's also no per-id story lookup endpoint a plain viewer can call
 * (`/stories/:id` 404s, `/stories/:id/details` 403s — owner-only). The story
 * feed (`fetchStoryFeed`) only ever contains currently-active stories, so it
 * doubles as both the thumbnail source and the expiry signal: if the id
 * isn't in it, the story is gone.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Lock, Play } from 'lucide-react-native';
import FastImage from '@d11/react-native-fast-image';

import type { StoryReplyPayload } from '../types/chat';
import type { RootStackNavigatorParamList } from '../../types/navigators';
import { setStoryFeedRings, type StoryRing } from '../../data/storyFeedCache';
import { fetchStoryFeed } from '../../services/story/storyApi';
import { useAppSelector } from '../../hooks/redux';
import { selectAuthToken } from '../../redux/features/auth/authSlice';
import { colorss } from '../../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = Math.min(SCREEN_WIDTH * 0.66, 260);

type Props = {
  story: StoryReplyPayload;
  /** Caption typed alongside the reply, if any. */
  caption?: string;
  isOwn: boolean;
};

export default function StoryReplyBubble({ story, caption, isOwn }: Props) {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackNavigatorParamList>>();
  const token = useAppSelector(selectAuthToken);
  const isVideo = story.type === 'VIDEO';

  // Resolved against the live feed — null while loading (never shown as
  // expired during that window), then either the matching ring or 'gone'.
  const [resolvedRing, setResolvedRing] = useState<StoryRing | null | 'gone'>(null);

  useEffect(() => {
    let cancelled = false;
    fetchStoryFeed(token).then(rings => {
      if (cancelled) return;
      const match = rings.find(r =>
        r.slides.some(s => String(s.id) === String(story.storyId)),
      );
      setResolvedRing(match ?? 'gone');
    });
    return () => {
      cancelled = true;
    };
  }, [story.storyId, token]);

  const resolvedSlide =
    resolvedRing && resolvedRing !== 'gone'
      ? resolvedRing.slides.find(s => String(s.id) === String(story.storyId))
      : undefined;

  // The feed not having loaded yet is not the same as the story being gone —
  // only flag expired once the lookup has actually come back empty.
  const isExpired = resolvedRing === 'gone';

  const previewUrl = isVideo
    ? (resolvedSlide?.thumbUri ?? story.thumbnailUrl ?? null)
    : (resolvedSlide?.uri ?? story.mediaUrl ?? story.thumbnailUrl ?? null);

  const openStory = useCallback(() => {
    if (isExpired) return;
    if (resolvedRing) {
      // Reopen the real, currently-live ring (all of that author's active
      // slides), not just the single story this reply pointed at.
      setStoryFeedRings([resolvedRing]);
      navigation.navigate('StoryViewer', { ringIndex: 0 });
      return;
    }
    if (!story.mediaUrl) return;
    setStoryFeedRings([
      {
        id: `reply_${story.storyId}`,
        name: story.authorName ?? 'Story',
        avatarUri: story.authorAvatarUrl ?? undefined,
        slides: [
          {
            id: story.storyId,
            uri: story.mediaUrl,
            durationMs: isVideo ? 15000 : 5000,
            type: isVideo ? 'video' : 'image',
            thumbUri: story.thumbnailUrl ?? null,
          },
        ],
      },
    ]);
    navigation.navigate('StoryViewer', { ringIndex: 0 });
  }, [isExpired, isVideo, navigation, resolvedRing, story]);

  return (
    <View style={[styles.wrap, isOwn ? styles.wrapRight : styles.wrapLeft]}>
      <View style={[styles.card, isExpired && styles.cardExpired]}>
        <TouchableOpacity
          style={styles.previewRow}
          onPress={openStory}
          activeOpacity={isExpired ? 1 : 0.8}
          disabled={isExpired}
        >
          <View style={styles.thumbWrap}>
            {isExpired ? (
              <View style={[styles.thumb, styles.thumbFallback]}>
                <Lock size={16} color="rgba(255,255,255,0.6)" />
              </View>
            ) : previewUrl ? (
              <FastImage source={{ uri: previewUrl }} style={styles.thumb} />
            ) : (
              <View style={[styles.thumb, styles.thumbFallback]}>
                {isVideo ? (
                  <Play size={18} color="#fff" fill="#fff" />
                ) : (
                  <Text style={styles.thumbFallbackTxt}>
                    {story.content?.trim().charAt(0)?.toUpperCase() || '📖'}
                  </Text>
                )}
              </View>
            )}
          </View>
          <View style={styles.textCol}>
            <Text style={styles.label}>
              {isExpired
                ? 'Story expired'
                : isOwn
                  ? 'You replied to their story'
                  : 'Replied to your story'}
            </Text>
            <Text style={styles.snippet} numberOfLines={1}>
              {story.type === 'TEXT'
                ? story.content || 'Text story'
                : story.content || (isVideo ? 'Video story' : 'Photo story')}
            </Text>
          </View>
        </TouchableOpacity>
        {caption ? (
          <View style={styles.captionRow}>
            <Text style={styles.captionTxt}>{caption}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    maxWidth: CARD_WIDTH,
    marginVertical: 2,
  },
  wrapLeft: { alignSelf: 'flex-start', marginLeft: 12 },
  wrapRight: { alignSelf: 'flex-end', marginRight: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F0D0DA',
  },
  cardExpired: {
    opacity: 0.7,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
  },
  thumbWrap: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  thumb: {
    width: 48,
    height: 64,
    borderRadius: 10,
  },
  thumbFallback: {
    backgroundColor: colorss.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbFallbackTxt: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: colorss.primary,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  snippet: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  captionRow: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0D0DA',
  },
  captionTxt: {
    fontSize: 14,
    color: colorss.textPrimary,
  },
});
