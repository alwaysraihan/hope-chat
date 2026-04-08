import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { colors, radius, fonts, colorss } from '../../theme';

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
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {item.active ? (
        <LinearGradient
          colors={['#7C3AED', '#EC4899', '#F59E0B']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.activeRing}
        >
          <LinearGradient
            colors={[item.bgFrom, item.bgTo]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.avatarInner}
          >
            <Text style={styles.emoji}>{item.emoji}</Text>
          </LinearGradient>
        </LinearGradient>
      ) : (
        <View style={styles.seenRing}>
          <LinearGradient
            colors={[item.bgFrom, item.bgTo]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.avatarInner}
          >
            <Text style={styles.emoji}>{item.emoji}</Text>
          </LinearGradient>
        </View>
      )}
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
  addRing: {
    width: 62,
    height: 62,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: '#3a3a54',
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
    color: "#ffffff",
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
