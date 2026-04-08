import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { colors } from '../../theme';

const ProfileAvatar = ({ emoji, bgFrom, bgTo, isOnline }) => {
  return (
    <View style={styles.avatarWrap}>
      <LinearGradient
        colors={['#FF4E8C', '#EC4899']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.outerRing}
      >
        <LinearGradient
          colors={[bgFrom, bgTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.avatarInner}
        >
          <Text style={styles.emoji}>{emoji}</Text>
        </LinearGradient>
      </LinearGradient>
      {isOnline && <View style={styles.onlineDot} />}
    </View>
  );
};

const styles = StyleSheet.create({
  avatarWrap: {
    position: 'absolute',
    top: -40,
    left: 20,
  },
  outerRing: {
    width: 82,
    height: 82,
    borderRadius: 41,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInner: {
    width: '100%',
    height: '100%',
    borderRadius: 38,
    borderWidth: 3,
    borderColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 28 },
  onlineDot: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.online,
    borderWidth: 3,
    borderColor: colors.background,
  },
});

export default ProfileAvatar;
