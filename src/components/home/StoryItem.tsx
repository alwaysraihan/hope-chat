import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, fonts, colorss } from '../../theme';
import LinearGradient from 'react-native-linear-gradient';
import FastImage from '@d11/react-native-fast-image';

/**
 * Portrait rounded tiles rather than circles. Ring / inner / image widths step
 * down by the ring thickness so the gradient reads as an even border, and each
 * radius drops with it so the corners stay concentric instead of bowing.
 */
const RING_W = 58;
const RING_H = 68;
const RING_R = 19;
const INNER_W = 54;
const INNER_H = 64;
const INNER_R = 17;
const IMG_W = 50;
const IMG_H = 60;
const IMG_R = 15;

type StoryLike = {
  isAdd?: boolean;
  id: string;
  name?: string;
  emoji?: string;
  avatarUrl?: string | null;
  bgFrom?: string;
  bgTo?: string;
  active?: boolean;
};

const StoryItem = ({
  item,
  onPress,
}: {
  item: StoryLike;
  onPress?: () => void;
}) => {
  // "Your story" — own avatar with a + badge, opens the story composer.
  if (item.isAdd) {
    return (
      <TouchableOpacity
        style={styles.recentItem}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={styles.avatarWrap}>
          <View style={styles.addTile}>
            {item.avatarUrl ? (
              <FastImage
                source={{ uri: item.avatarUrl }}
                style={styles.miniAvatar}
              />
            ) : (
              <View style={styles.initialCircle}>
                <Text style={styles.initialText}>
                  {(item.name ?? '?').trim().charAt(0).toUpperCase() || '?'}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.addBadge}>
            <Text style={styles.addIcon}>+</Text>
          </View>
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
        <LinearGradient
          colors={[item.bgFrom ?? '#444', item.bgTo ?? '#888']}
          style={styles.gradientRing}
        >
          <View style={styles.innerCircle}>
            {item.avatarUrl ? (
              <FastImage
                source={{ uri: item.avatarUrl }}
                style={styles.miniAvatar}
              />
            ) : item.emoji ? (
              <Text style={styles.emoji}>{item.emoji}</Text>
            ) : (
              <View style={styles.initialCircle}>
                <Text style={styles.initialText}>
                  {(item.name ?? '?').trim().charAt(0).toUpperCase() || '?'}
                </Text>
              </View>
            )}
          </View>
        </LinearGradient>
        {item.active && <View style={styles.onlineDot} />}
      </View>
      <Text style={styles.recentName} numberOfLines={1}>
        {item.name ?? '…'}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: 66,
    marginRight: 4,
  },
  recentItem: {
    alignItems: 'center',
    marginRight: 4,
    width: 66,
  },
  recentName: {
    fontSize: 11,
    color: colorss.textPrimary,
    marginTop: 4,
    textAlign: 'center',
    maxWidth: 60,
    fontWeight: fonts.medium,
  },
  avatarWrap: {
    position: 'relative',
  },
  gradientRing: {
    width: RING_W,
    height: RING_H,
    borderRadius: RING_R,
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  innerCircle: {
    width: INNER_W,
    height: INNER_H,
    borderRadius: INNER_R,
    backgroundColor: colorss.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniAvatar: {
    width: IMG_W,
    height: IMG_H,
    borderRadius: IMG_R,
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
    bottom: -1,
    right: -1,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.online,
    borderWidth: 2,
    borderColor: colorss.white,
  },
  addTile: {
    width: RING_W,
    height: RING_H,
    borderRadius: RING_R,
    backgroundColor: colorss.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colorss.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colorss.white,
  },
  addIcon: {
    fontSize: 15,
    color: '#ffffff',
    fontWeight: fonts.bold,
    lineHeight: 17,
  },
});

export default StoryItem;
