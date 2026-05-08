import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { spacing, radius, fonts, theme } from '../../theme';
import { Camera, SquarePen } from 'lucide-react-native';

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
          <Camera size={18} color={theme.textPrimary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={onNewChat}
          activeOpacity={0.8}
        >
          <SquarePen size={18} color={theme.textPrimary} />
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
    color: theme.textPrimary,
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
    backgroundColor: theme.secondary,
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
