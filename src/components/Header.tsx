import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { colors, spacing, radius, fonts } from '../theme';

const Header = ({ onSearch, onNewChat }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hope Chat</Text>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.iconBtn} onPress={onSearch} activeOpacity={0.7}>
          {/* Search icon */}
          <View style={styles.searchIcon}>
            <View style={styles.searchCircle} />
            <View style={styles.searchHandle} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity onPress={onNewChat} activeOpacity={0.8}>
          <LinearGradient
            colors={[colors.purple, colors.purpleLight]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.newChatBtn}
          >
            {/* Compose icon */}
            <View style={styles.composeIcon}>
              <View style={styles.composeBubble} />
              <View style={styles.composeDots}>
                {[0, 1, 2].map(i => (
                  <View key={i} style={styles.composeDot} />
                ))}
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  title: {
    fontSize: 26,
    fontWeight: fonts.bold,
    color: colors.white,
    letterSpacing: -0.5,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: '#1e1e30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchIcon: {
    width: 16,
    height: 16,
    position: 'relative',
  },
  searchCircle: {
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.purpleLight,
    position: 'absolute',
    top: 0,
    left: 0,
  },
  searchHandle: {
    width: 1.5,
    height: 5,
    backgroundColor: colors.purpleLight,
    position: 'absolute',
    bottom: 0,
    right: 1,
    transform: [{ rotate: '-45deg' }],
  },
  newChatBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composeIcon: {
    width: 18,
    height: 16,
    position: 'relative',
  },
  composeBubble: {
    width: 16,
    height: 14,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.white,
    position: 'absolute',
    top: 0,
    left: 0,
  },
  composeDots: {
    flexDirection: 'row',
    gap: 2,
    position: 'absolute',
    top: 4,
    left: 3,
  },
  composeDot: {
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.white,
  },
});

export default Header;
