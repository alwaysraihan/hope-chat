import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { colors, fonts, colorss } from '../../theme';
import FastImage from '@d11/react-native-fast-image';

const IMG_W = 64;
const IMG_H = 76;
const IMG_R = 12;

// Ring sits just outside the avatar, same concentric-radius technique as
// Hopenity's circular story ring — just applied to this rounded-square shape
// instead of a circle.
const RING_BORDER = 3;
const RING_W = IMG_W + RING_BORDER * 2;
const RING_H = IMG_H + RING_BORDER * 2;
const RING_R = IMG_R + RING_BORDER;

// primaryLight/primary/primaryDark are too close in hue to read as a real
// blend on a ring this thin — widens the spread into purple so the color
// shift around the ring is actually visible, Instagram-ring style, instead
// of reading as a single flat pink.
const UNSEEN_GRADIENT = ['#FFA75A', colorss.primary, '#7C3AED'];
/** "Already seen" reads as a muted, desaturated version of the same ring —
 * still a gradient (not a flat color), just toned down instead of bright. */
const SEEN_GRADIENT = [colorss.border, colorss.textSecondary, colorss.border];

type StoryLike = {
  isAdd?: boolean;
  id: string;
  name?: string;
  emoji?: string;
  avatarUrl?: string | null;
  active?: boolean;
  /** Has a live story — draws a ring so the card visibly reads as a story, not just a contact. */
  hasStory?: boolean;
  /** All slides viewed — ring goes muted instead of the bright unseen gradient. */
  storySeen?: boolean;
};

/**
 * Wraps the avatar in a gradient ring when there's a story, or renders it
 * plain otherwise. The ring is drawn as an absolutely-positioned gradient
 * square sitting BEHIND the avatar (both pinned to the same explicitly-sized
 * parent box, `avatarWrap`) rather than a padding-centered wrapper around
 * it — padding-based centering inside an auto-sized parent was rendering
 * the ring incompletely (only the top/left edge visible) once nested inside
 * the FlatList's cell measurement, so this avoids relying on any of that.
 */
function StoryFrame({ item }: { item: StoryLike }) {
  if (!item.hasStory) return null;
  return (
    <LinearGradient
      colors={item.storySeen ? SEEN_GRADIENT : UNSEEN_GRADIENT}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.ring}
    />
  );
}

const StoryItem = ({
  item,
  onPress,
  onBadgePress,
}: {
  item: StoryLike;
  onPress?: () => void;
  /** "+" badge tap, when it should do something different from the main
   * tap (e.g. main tap views an existing story, badge always adds a new one). */
  onBadgePress?: () => void;
}) => {
  const initial = (item.name ?? '?').trim().charAt(0).toUpperCase() || '?';

  // "Your story" — own avatar with a + badge, opens the story composer.
  if (item.isAdd) {
    return (
      <TouchableOpacity
        style={styles.recentItem}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={styles.avatarWrap}>
          <StoryFrame item={item} />
          {item.avatarUrl ? (
            <FastImage
              source={{ uri: item.avatarUrl }}
              style={styles.miniAvatar}
            />
          ) : (
            <View style={styles.initialCircle}>
              <Text style={styles.initialText}>{initial}</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.addBadge}
            onPress={onBadgePress ?? onPress}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Text style={styles.addIcon}>+</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.recentName} numberOfLines={1}>
          {item.name ?? 'You'}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={styles.recentItem} onPress={onPress}>
      <View style={styles.avatarWrap}>
        <StoryFrame item={item} />
        {item.avatarUrl ? (
          <FastImage
            source={{ uri: item.avatarUrl }}
            style={styles.miniAvatar}
          />
        ) : item.emoji ? (
          <View style={[styles.miniAvatar, styles.emojiWrap]}>
            <Text style={styles.emoji}>{item.emoji}</Text>
          </View>
        ) : (
          <View style={styles.initialCircle}>
            <Text style={styles.initialText}>{initial}</Text>
          </View>
        )}
        {item.active && <View style={styles.onlineDot} />}
      </View>
      <Text style={styles.recentName} numberOfLines={1}>
        {item.name ?? '…'}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  recentItem: {
    alignItems: 'center',
    // Wide enough for the ring (bigger than the plain avatar by RING_BORDER
    // on each side) — a column sized to only the avatar clipped the ring
    // asymmetrically against the neighboring tile.
    width: RING_W,
  },
  recentName: {
    fontSize: 11,
    color: colorss.textPrimary,
    marginTop: 4,
    textAlign: 'center',
    maxWidth: RING_W,
    fontWeight: fonts.medium,
  },
  // Explicitly sized and centers its children itself — the ring (absolute,
  // behind) and the avatar (normal flow, on top) both key off this fixed
  // box instead of auto-sizing from content, which is what was leaving the
  // ring's bottom/right edge unmeasured.
  avatarWrap: {
    position: 'relative',
    width: RING_W,
    height: RING_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: RING_W,
    height: RING_H,
    borderRadius: RING_R,
  },
  miniAvatar: {
    width: IMG_W,
    height: IMG_H,
    borderRadius: IMG_R,
  },
  emojiWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colorss.surface,
  },
  initialCircle: {
    width: IMG_W,
    height: IMG_H,
    borderRadius: IMG_R,
    backgroundColor: colorss.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: fonts.bold,
  },
  emoji: {
    fontSize: 26,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: colors.online,
    borderWidth: 2,
    borderColor: colorss.white,
  },
  addBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colorss.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colorss.white,
  },
  addIcon: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: fonts.bold,
    lineHeight: 16,
  },
});

export default StoryItem;
