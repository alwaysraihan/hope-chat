import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { colors, radius, fonts, colorss } from '../../theme';
import { IC_PROFILE } from '../../assets';

const StoryItem = ({ item, onPress }) => {
  // if (item.isAdd) {
  //   return (
  //     <TouchableOpacity
  //       style={styles.container}
  //       onPress={onPress}
  //       activeOpacity={0.7}
  //     >
  //       <View style={styles.addAvatar}>
  //         <Text style={styles.addIcon}>+</Text>
  //       </View>
  //       <Text style={styles.addName}>Add</Text>
  //     </TouchableOpacity>
  //   );
  // }

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.avatarWrap}>
        <Image source={IC_PROFILE} style={styles.avatar} />
        {item.active && <View style={styles.onlineDot} />}
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {item.name}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 6,
    width: 62,
  },
  activeRing: {
    width: 62,
    height: 62,
    borderRadius: radius.full,
    padding: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seenRing: {
    width: 62,
    height: 62,
    borderRadius: radius.full,
    padding: 2.5,
    backgroundColor: '#2a2a3d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addAvatar: {
    width: 62,
    height: 62,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colorss.primary,
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
    bottom: 3,
    right: 3,
    width: 10,
    height: 10,
    borderRadius: radius.full,
    backgroundColor: colors.online,
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
