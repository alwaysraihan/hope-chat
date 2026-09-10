import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, fonts, colorss } from '../../theme';
import FastImage from '@d11/react-native-fast-image';

const IMG_W = 64;
const IMG_H = 76;
const IMG_R = 12;

type StoryLike = {
  isAdd?: boolean;
  id: string;
  name?: string;
  emoji?: string;
  avatarUrl?: string | null;
  active?: boolean;
};

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
    width: IMG_W,
  },
  recentName: {
    fontSize: 11,
    color: colorss.textPrimary,
    marginTop: 4,
    textAlign: 'center',
    maxWidth: IMG_W,
    fontWeight: fonts.medium,
  },
  avatarWrap: {
    position: 'relative',
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
