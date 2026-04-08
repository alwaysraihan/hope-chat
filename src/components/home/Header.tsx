import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { colors, spacing, radius, fonts, colorss } from '../../theme';
import { LucideKeyboard, LucideSearch } from 'lucide-react-native';

const Header = ({ onSearch, onNewChat }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hope Chat</Text>
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={onSearch}
          activeOpacity={0.7}
        >
          <LucideSearch size={18} color={colorss.primary} />
        </TouchableOpacity>

        <TouchableOpacity onPress={onNewChat} activeOpacity={0.8}>
          <LinearGradient
            colors={[colors.purple, colors.purpleLight]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.newChatBtn}
          >
            <LucideKeyboard size={18} color={colors.white} />
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
    backgroundColor: "white",
    alignItems: 'center',
    justifyContent: 'center',
  },
  newChatBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default Header;
