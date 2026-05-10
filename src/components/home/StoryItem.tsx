import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, radius, fonts, colorss } from '../../theme';
import LinearGradient from 'react-native-linear-gradient';
import FastImage from '@d11/react-native-fast-image';

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
  if (item.isAdd) {
    return (
      <TouchableOpacity
        style={styles.container}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={styles.addRing}>
          <View style={styles.addAvatar}>
            <Text style={styles.addIcon}>+</Text>
          </View>
        </View>
        <Text style={styles.addName}>Add</Text>
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
    gap: 6,
    width: 62,
    height: 72,
    marginRight: 4,
  },
  recentItem: {
    alignItems: 'center',
    marginRight: 4,
    width: 62,
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
    width: 58,
    height: 58,
    borderRadius: radius.full,
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  innerCircle: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: colorss.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  initialCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
    width: 12,
    height: 12,
    borderRadius: radius.full,
    backgroundColor: colors.online,
  },
  addRing: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    borderStyle: 'dashed',
    backgroundColor: colorss.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addIcon: {
    fontSize: 26,
    color: '#ffffff',
    fontWeight: fonts.bold,
    lineHeight: 28,
  },
  addName: {
    fontSize: 10,
    color: colorss.textPrimary,
    fontWeight: fonts.medium,
    textAlign: 'center',
  },
});

export default StoryItem;
