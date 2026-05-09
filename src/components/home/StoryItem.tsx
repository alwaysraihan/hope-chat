import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { colors, radius, fonts, colorss } from '../../theme';
import { IC_PROFILE } from '../../assets';

const StoryItem = ({ item, onPress }) => {
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
    <TouchableOpacity style={styles.recentItem}>
      <View style={styles.avatarWrap}>
        <Image source={IC_PROFILE} style={styles.avatar} />
        {item.active && <View style={styles.onlineDot} />}
      </View>
      <Text style={styles.recentName}>Raihan</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 6,
    width: 52,
    height: 52,
  },
  recentItem: {
    alignItems: 'center',
  },
  recentName: {
    fontSize: 14,
    color: colorss.textPrimary,
    marginTop: 4,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
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
  avatarInner: {
    width: '100%',
    height: '100%',
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: '#0F0F1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 24,
  },
  addIcon: {
    fontSize: 26,
    color: '#ffffff',
    fontWeight: fonts.bold,
    lineHeight: 28,
  },
  name: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: fonts.medium,
    textAlign: 'center',
    width: 62,
  },
  addName: {
    fontSize: 10,
    color: colorss.textPrimary,
    fontWeight: fonts.medium,
    textAlign: 'center',
  },
});

export default StoryItem;
